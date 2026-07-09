"""Recommendation endpoints — content-based feed powered by pgvector.

/for-me    personalized feed (taste vector → ANN retrieval → rerank → MMR)
/similar   "more like this fic" (fic's own vector → ANN)
/trending  popularity fallback (no personalization; always works)

Design contract: NEVER a hard dependency on the pipeline. /for-me is
cache-behind — it serves the last-good list instantly and refreshes in
the background; on cold start (no taste vector yet) it falls back to
trending so the endpoint always returns 200 with something.
"""
from __future__ import annotations
import json
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from app.core.dependencies import get_current_user, get_current_user_optional
from app.db.models.user import UserModel
from app.db.session import AsyncSessionLocal
from app.services.recommender import taste, retrieval, rerank

logger = logging.getLogger(__name__)
router = APIRouter()

# How long a cached /for-me payload stays fresh before a background rebuild.
_CACHE_TTL = timedelta(hours=6)


def _card_from_candidate(c: dict) -> dict:
    """Shape a retrieval row into the Fanfic card shape the frontend rails
    already render."""
    fandoms = c.get("fandoms")
    if isinstance(fandoms, str):
        try:
            fandoms = json.loads(fandoms)
        except Exception:
            fandoms = []
    tags = c.get("tags")
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except Exception:
            tags = []
    return {
        "id": c["id"],
        "title": c.get("title") or "",
        "author_name": c.get("author_name") or "",
        "cover_url": c.get("cover_url"),
        "direction": c.get("direction") or "Неизвестно",
        "rating": c.get("rating") or "Неизвестно",
        "completion_status": c.get("completion_status") or "Неизвестно",
        "fandoms": fandoms or [],
        "tags": tags or [],
        "likes": int(c.get("likes") or 0),
        "trophies": int(c.get("trophies") or 0),
        "score": round(float(c.get("score") or 0.0), 4),
        "ficbook_url": f"https://ficbook.net/readfic/{c['id']}",
    }


async def _trending(limit: int) -> list[dict]:
    """Popularity fallback straight from the enriched catalog — no vectors
    needed, so it works even with an empty taste vector."""
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(text("""
            SELECT id, title, author_name, cover_url, direction, rating,
                   completion_status, fandoms, tags, likes, trophies, comments_count
            FROM fanfics
            WHERE enrichment_status = 'enriched'
            ORDER BY likes DESC NULLS LAST, trophies DESC NULLS LAST
            LIMIT :lim
        """), {"lim": limit})).mappings().all()
        return [_card_from_candidate(dict(r)) for r in rows]


async def _read_ids(user_id: str) -> list[str]:
    """All fanfic ids the user has already signalled — excluded from recs."""
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(text("""
            SELECT fanfic_id FROM user_bookmarks     WHERE user_id = :uid
            UNION SELECT fanfic_id FROM user_anchors       WHERE user_id = :uid
            UNION SELECT fanfic_id FROM user_local_history WHERE user_id = :uid
        """), {"uid": user_id})).all()
        return [r[0] for r in rows]


async def _build_feed(user_id: str, limit: int) -> list[dict]:
    """Full pipeline: (re)build taste vector → retrieve → rerank → MMR.
    Returns [] if the user is cold (no signals with embeddings yet)."""
    await taste.build_taste_vector(user_id)
    read_ids = await _read_ids(user_id)
    candidates = await retrieval.retrieve_candidates(user_id, limit=300, exclude_ids=read_ids)
    if not candidates:
        return []
    rerank.rerank(candidates)
    picked = rerank.mmr_diversify(candidates, k=limit)
    return [_card_from_candidate(c) for c in picked]


@router.get("/for-me")
async def get_recommendations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    refresh: bool = Query(False),
    current_user: UserModel = Depends(get_current_user),
):
    """Personalized feed. Cache-behind: serve cached payload if fresh,
    else rebuild. Falls back to trending on cold start."""
    uid = current_user.id

    # 1. Serve fresh cache unless refresh requested.
    if not refresh:
        async with AsyncSessionLocal() as db:
            cached = (await db.execute(text(
                "SELECT payload, stale_after FROM user_recommendations WHERE user_id = :uid"
            ), {"uid": uid})).first()
        if cached and cached[0] and cached[1] and cached[1] > datetime.utcnow():
            items = cached[0].get("items", []) if isinstance(cached[0], dict) else []
            if items:
                return {"items": items[:page_size], "source": "cache"}

    # 2. Rebuild.
    try:
        items = await _build_feed(uid, limit=max(page_size, 30))
    except Exception as e:
        logger.warning("feed build failed for %s: %s", uid, e)
        items = []

    source = "personalized"
    if not items:
        # Cold start / pipeline empty → trending.
        items = await _trending(page_size)
        source = "trending"
    else:
        # Cache the personalized payload.
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(text("""
                    INSERT INTO user_recommendations (user_id, payload, generated_at, stale_after)
                    VALUES (:uid, CAST(:payload AS json), now(), :stale)
                    ON CONFLICT (user_id) DO UPDATE
                      SET payload = EXCLUDED.payload, generated_at = now(),
                          stale_after = EXCLUDED.stale_after
                """), {
                    "uid": uid,
                    "payload": json.dumps({"items": items}, ensure_ascii=False),
                    "stale": datetime.utcnow() + _CACHE_TTL,
                })
                await db.commit()
        except Exception as e:
            logger.warning("cache write failed for %s: %s", uid, e)

    return {"items": items[:page_size], "source": source}


@router.get("/similar/{fanfic_id}")
async def get_similar(
    fanfic_id: str,
    limit: int = Query(10, ge=1, le=30),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    """More-like-this: ANN off the fic's own embedding vector."""
    async with AsyncSessionLocal() as db:
        src = (await db.execute(text(
            "SELECT embedding_vec::vector::text FROM fanfics "
            "WHERE id = :id AND embedding_vec IS NOT NULL"
        ), {"id": fanfic_id})).first()
        if not src or not src[0]:
            # fic not enriched yet — fall back to trending
            return {"items": await _trending(limit), "source": "trending"}

        rows = (await db.execute(text("""
            SELECT id, title, author_name, cover_url, direction, rating,
                   completion_status, fandoms, tags, likes, trophies, comments_count,
                   1 - (embedding_vec <=> CAST(:v AS halfvec)) AS score
            FROM fanfics
            WHERE embedding_vec IS NOT NULL AND enrichment_status='enriched'
              AND id <> :id
            ORDER BY embedding_vec <=> CAST(:v AS halfvec)
            LIMIT :lim
        """), {"v": src[0], "id": fanfic_id, "lim": limit})).mappings().all()
        return {"items": [_card_from_candidate(dict(r)) for r in rows], "source": "similar"}


@router.get("/trending")
async def get_trending(
    period: str = Query("week", pattern="^(day|week|month)$"),
    limit: int = Query(20, ge=1, le=50),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    """Popularity feed from the enriched catalog. Always works."""
    return {"items": await _trending(limit), "source": "trending"}
