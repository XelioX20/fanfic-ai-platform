"""Catalog ingestion for the recommendation system.

Two sources feed the `fanfics` catalog, both via `upsert_stub`:
  1. Reactive — every time a user opens or bookmarks a fic, we upsert a
     lightweight stub from the card metadata on the request payload.
  2. Autonomous discovery — the crawler in internal.py (`/discover/crawl`,
     Worker-cron driven) walks ficbook listing sections and upserts every
     card it finds, so the catalog grows independently of what users read.

Both mark rows `enrichment_status='pending'`; the background enrichment
cron then fetches the full page, scores genres, and embeds it.

`upsert_stub` is best-effort and MUST NOT raise into the caller — a
failure here can never block the user's read/bookmark write.
"""
from __future__ import annotations
import json
import logging
from typing import Optional
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def upsert_stub(
    fanfic_id: str,
    *,
    title: Optional[str] = None,
    author_name: Optional[str] = None,
    author_id: Optional[str] = None,
    cover_url: Optional[str] = None,
    direction: Optional[str] = None,
    rating: Optional[str] = None,
    completion_status: Optional[str] = None,
    fandoms: Optional[list] = None,
) -> None:
    """Insert a minimal fanfics row if absent, so the enrichment cron can
    later fill in tags/embedding. Never overwrites an already-enriched row's
    curated fields — only fills a fresh stub. Swallows all errors."""
    if not fanfic_id:
        return
    try:
        async with AsyncSessionLocal() as db:
            # Does a row already exist?
            exists = (await db.execute(
                text("SELECT enrichment_status FROM fanfics WHERE id = :id"),
                {"id": fanfic_id},
            )).first()
            if exists:
                return  # leave enrichment state + curated data untouched

            # ficbook_url is NOT NULL + unique in the schema — synthesize it.
            ficbook_url = f"https://ficbook.net/readfic/{fanfic_id}"
            from sqlalchemy import bindparam, String as SAString
            from sqlalchemy.dialects.postgresql import ARRAY as PGARRAY
            stmt = text(
                "INSERT INTO fanfics "
                "  (id, title, author_name, author_id, cover_url, direction, rating, "
                "   completion_status, fandoms, pairings, tags, ficbook_url, "
                "   likes, trophies, words_count, chapters_count, comments_count, is_hot, "
                "   enrichment_status, enrichment_attempts, scraped_at) "
                "VALUES "
                "  (:id, :title, :author_name, :author_id, :cover_url, :direction, :rating, "
                "   :completion_status, :fandoms, CAST('[]' AS json), CAST('[]' AS json), "
                "   :ficbook_url, 0, 0, 0, 0, 0, false, "
                "   'pending', 0, now()) "
                "ON CONFLICT (id) DO NOTHING"
            ).bindparams(bindparam("fandoms", type_=PGARRAY(SAString)))
            await db.execute(stmt, {
                "id": fanfic_id,
                "title": (title or f"Фанфик {fanfic_id[:8]}")[:500],
                "author_name": (author_name or "")[:200],
                "author_id": (author_id or None),
                "cover_url": (cover_url or None),
                "direction": (direction or "Неизвестно")[:50],
                "rating": (rating or "Неизвестно")[:20],
                "completion_status": (completion_status or "Неизвестно")[:50],
                # fandoms is a Postgres varchar[] — typed bindparam serializes it.
                "fandoms": fandoms or [],
                "ficbook_url": ficbook_url,
            })
            await db.commit()
    except Exception as e:
        # Best-effort: log and move on. Never propagate to the sync write.
        logger.warning("upsert_stub failed for %s: %s", fanfic_id, e)
