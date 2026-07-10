"""Internal / diagnostic endpoints for the recommendation pipeline.

Secret-gated (X-Internal-Secret header must match ENRICH_SECRET) so these
can't be hit by the public. Called by the Cloudflare Worker cron and used
for pipeline diagnostics.
"""
import hashlib
import logging
import os
from fastapi import APIRouter, HTTPException, Header, Request, Query
from typing import Optional
from sqlalchemy import text
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.services.recommender import embed_client, tag_genre

logger = logging.getLogger(__name__)
router = APIRouter()

WORKER_URL = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")


def _check_secret(secret: Optional[str]) -> None:
    expected = settings.ENRICH_SECRET
    if not expected:
        raise HTTPException(status_code=503, detail="Internal endpoints disabled (ENRICH_SECRET unset)")
    if secret != expected:
        raise HTTPException(status_code=403, detail="Bad internal secret")


@router.get("/reco/status")
async def reco_status(x_internal_secret: Optional[str] = Header(None)):
    """Diagnostic: confirms pgvector is live and reports enrichment progress.
    Used to verify Phase 1 landed correctly on Neon and to monitor the
    enrichment backlog in Phase 2."""
    _check_secret(x_internal_secret)

    out: dict = {}
    async with AsyncSessionLocal() as db:
        # 1. Is pgvector installed?
        try:
            r = await db.execute(text("SELECT extversion FROM pg_extension WHERE extname='vector'"))
            row = r.first()
            out["pgvector"] = row[0] if row else None
        except Exception as e:
            out["pgvector"] = f"error: {e}"

        # 2. Does the halfvec column exist on fanfics?
        try:
            r = await db.execute(text(
                "SELECT data_type, udt_name FROM information_schema.columns "
                "WHERE table_name='fanfics' AND column_name='embedding_vec'"
            ))
            row = r.first()
            out["embedding_vec_column"] = (row[1] if row else None)
        except Exception as e:
            out["embedding_vec_column"] = f"error: {e}"

        # 3. Enrichment backlog breakdown
        try:
            r = await db.execute(text(
                "SELECT enrichment_status, COUNT(*) FROM fanfics GROUP BY enrichment_status"
            ))
            out["enrichment_counts"] = {k: v for k, v in r.all()}
        except Exception as e:
            out["enrichment_counts"] = f"error: {e}"

        # 4. How many fics actually have a vector
        try:
            r = await db.execute(text("SELECT COUNT(*) FROM fanfics WHERE embedding_vec IS NOT NULL"))
            out["fics_with_vector"] = r.scalar()
        except Exception as e:
            out["fics_with_vector"] = f"error: {e}"

        # 5. Recent enrichment errors (diagnostics)
        try:
            r = await db.execute(text(
                "SELECT id, enrichment_attempts, LEFT(enrichment_error, 200) "
                "FROM fanfics WHERE enrichment_error IS NOT NULL "
                "ORDER BY embedded_at DESC NULLS LAST LIMIT 5"
            ))
            out["recent_errors"] = [{"id": a, "attempts": b, "error": c} for a, b, c in r.all()]
        except Exception as e:
            out["recent_errors"] = f"error: {e}"

        # 6. Actual column types for the array/json fields (schema drift check)
        try:
            r = await db.execute(text(
                "SELECT column_name, data_type, udt_name FROM information_schema.columns "
                "WHERE table_name='fanfics' AND column_name IN "
                "('tags','pairings','fandoms','description')"
            ))
            out["column_types"] = {a: (b, c) for a, b, c in r.all()}
        except Exception as e:
            out["column_types"] = f"error: {e}"

    return out


def _build_embed_text(title: str, fandoms, pairings, tags, description: str) -> str:
    """Russian embed template — one string per fic fed to bge-m3."""
    def _join(x):
        if isinstance(x, list):
            return ", ".join(str(i) for i in x if i)
        return str(x or "")
    parts = [title or ""]
    if fandoms:  parts.append(f"Фэндом: {_join(fandoms)}")
    if pairings: parts.append(f"Пейринги: {_join(pairings)}")
    if tags:     parts.append(f"Метки: {_join(tags)}")
    if description: parts.append(description)
    return ". ".join(p for p in parts if p)[:6000]


@router.post("/enrich/reset-failed")
async def reset_failed(x_internal_secret: Optional[str] = Header(None)):
    """Reset failed/errored fics back to pending (attempts=0) so they get
    retried — used after fixing an enrichment bug."""
    _check_secret(x_internal_secret)
    async with AsyncSessionLocal() as db:
        r = await db.execute(text(
            "UPDATE fanfics SET enrichment_status='pending', enrichment_attempts=0, "
            "enrichment_error=NULL "
            "WHERE enrichment_status='failed' OR enrichment_attempts > 0"
        ))
        await db.commit()
        return {"reset": r.rowcount}


@router.get("/reco/taste-debug/{user_id}")
async def taste_debug(user_id: str, x_internal_secret: Optional[str] = Header(None)):
    """Diagnose why a user's taste vector is (or isn't) built: how many of
    their signalled fics exist in the catalog and how many have embeddings."""
    _check_secret(x_internal_secret)
    async with AsyncSessionLocal() as db:
        signalled = (await db.execute(text("""
            SELECT COUNT(DISTINCT fanfic_id) FROM (
                SELECT fanfic_id FROM user_bookmarks WHERE user_id = :uid
                UNION SELECT fanfic_id FROM user_anchors WHERE user_id = :uid
                UNION SELECT fanfic_id FROM user_local_history WHERE user_id = :uid
            ) s
        """), {"uid": user_id})).scalar()

        in_catalog = (await db.execute(text("""
            WITH sig AS (
                SELECT fanfic_id FROM user_bookmarks WHERE user_id = :uid
                UNION SELECT fanfic_id FROM user_anchors WHERE user_id = :uid
                UNION SELECT fanfic_id FROM user_local_history WHERE user_id = :uid
            )
            SELECT COUNT(*) FROM sig JOIN fanfics f ON f.id = sig.fanfic_id
        """), {"uid": user_id})).scalar()

        with_vec = (await db.execute(text("""
            WITH sig AS (
                SELECT fanfic_id FROM user_bookmarks WHERE user_id = :uid
                UNION SELECT fanfic_id FROM user_anchors WHERE user_id = :uid
                UNION SELECT fanfic_id FROM user_local_history WHERE user_id = :uid
            )
            SELECT COUNT(*) FROM sig JOIN fanfics f ON f.id = sig.fanfic_id
            WHERE f.embedding_vec IS NOT NULL
        """), {"uid": user_id})).scalar()

        tv = (await db.execute(text(
            "SELECT n_signals, built_at FROM user_taste_vectors WHERE user_id = :uid"
        ), {"uid": user_id})).first()

        # Try building it now and capture any error.
        from app.services.recommender import taste
        try:
            build_result = await taste.build_taste_vector(user_id)
        except Exception as e:
            build_result = f"error: {type(e).__name__}: {str(e)[:300]}"

        return {
            "signalled_fics": signalled,
            "signalled_in_catalog": in_catalog,
            "signalled_with_vector": with_vec,
            "taste_vector_row": {"n_signals": tv[0], "built_at": str(tv[1])} if tv else None,
            "rebuild_result": build_result,
        }


@router.get("/reco/facets-debug/{user_id}")
async def facets_debug(user_id: str, x_internal_secret: Optional[str] = Header(None)):
    """Force a facet rebuild and report the resulting cluster structure —
    number of facets, mass split, and labels. Diagnoses 4.2 clustering."""
    _check_secret(x_internal_secret)
    from app.services.recommender import taste
    try:
        facets = await taste.build_facets(user_id)
    except Exception as e:
        return {"error": f"{type(e).__name__}: {str(e)[:300]}"}
    if not facets:
        return {"facets": 0, "note": "cold start — no signals with embeddings"}
    return {
        "facets": len(facets),
        "detail": [
            {"label": f.get("label"), "mass": f.get("mass"),
             "top_tags": list((f.get("tag_scores") or {}).keys())[:5]}
            for f in facets
        ],
    }


@router.post("/enrich/llm-probe")
async def llm_probe(
    request: Request,
    x_internal_secret: Optional[str] = Header(None),
):
    """Smoke-test the LLM enrichment path on a fixed sample fic's metadata —
    proves the Worker /enrich-llm endpoint + Llama 3.3 70B round-trip works
    (including on adult content) without waiting for the cron."""
    _check_secret(x_internal_secret)
    from app.services.recommender import llm_enrich
    http = request.app.state.http
    if not llm_enrich.is_configured():
        return {"configured": False, "note": "EMBED_WORKER_URL/SECRET unset"}
    result = await llm_enrich.enrich_llm(
        title="Тени над Хогвартсом",
        fandoms=["Гарри Поттер"],
        pairings=["Гарри Поттер / Драко Малфой"],
        tags=["Слэш", "Ангст", "Хёрт/комфорт", "Драма", "Насилие"],
        description="Мрачная история о том, как война меняет людей. Гарри и Драко "
                    "оказываются по одну сторону баррикад, и им приходится научиться "
                    "доверять друг другу, преодолевая боль прошлого.",
        http=http,
    )
    return {"configured": True, "result": result}


@router.post("/enrich/run")
async def enrich_run(
    request: Request,
    batch: int = Query(None, ge=1, le=50),
    x_internal_secret: Optional[str] = Header(None),
):
    """Drain the enrichment queue: take up to `batch` pending fics, fetch +
    parse each via the CF proxy, compute tag→genre scores, embed the text,
    and write the vector. Idempotent and bounded — safe to call on a cron.

    Called by the Worker's */15 cron. Returns a small summary.
    """
    _check_secret(x_internal_secret)
    limit = batch or settings.ENRICH_BATCH_SIZE

    http = request.app.state.http
    from ficbook_parser.parsers.fanfic_page import FanficPageParser

    processed, enriched, failed = 0, 0, 0
    first_error = None

    # 1. Pick pending fics (attempts < 3). Do this in its own session so the
    #    row lock is short; we re-open per-write below.
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(text(
            "SELECT id FROM fanfics "
            "WHERE enrichment_status = 'pending' AND enrichment_attempts < 3 "
            "ORDER BY scraped_at DESC NULLS LAST LIMIT :lim"
        ), {"lim": limit})).all()
    fic_ids = [r[0] for r in rows]

    if not fic_ids:
        return {"processed": 0, "enriched": 0, "failed": 0, "note": "queue empty"}

    for fid in fic_ids:
        processed += 1
        try:
            # Fetch + parse full page via the CF proxy (10-min edge cache).
            import re as _re
            ficbook_path = f"readfic/{fid}"
            resp = await http.get(f"{WORKER_URL}/{ficbook_path}")
            resp.raise_for_status()
            raw = resp.content.decode("utf-8", errors="replace")
            try:
                import ftfy
                html = ftfy.fix_text(raw)
            except ImportError:
                html = raw
            page = FanficPageParser().parse(html, fid)

            tags = [t.name for t in page.tags] if page.tags else []
            pairings = [" / ".join(p.characters) for p in page.pairings] if page.pairings else []
            fandoms = page.fandoms or []
            description = page.description or ""
            direction = page.direction.value if hasattr(page.direction, "value") else str(page.direction or "")

            scores = tag_genre.score_from_tags(tags, direction, description)

            # ── LLM refinement tier (5.1) — best-effort ──────────────────
            # Llama 3.3 70B surfaces untagged tropes + refines genre scores.
            # On any failure llm=None and we keep the deterministic scores.
            from app.services.recommender import llm_enrich
            llm = await llm_enrich.enrich_llm(
                title=page.name, fandoms=fandoms, pairings=pairings,
                tags=tags, description=description, http=http,
            )
            derived_tags: list[str] = []
            llm_mood = None
            llm_audience = None
            if llm:
                derived_tags = llm.get("derived_tags") or []
                llm_mood = llm.get("mood") or None
                llm_audience = llm.get("audience") or None
                # Blend: average deterministic + LLM where both cover a genre.
                # LLM adds hurt_comfort + dark which the lexicon doesn't score.
                g = llm.get("genres") or {}
                for key in ("romance", "angst", "fluff", "drama", "humor", "adventure", "mystery"):
                    if key in g:
                        scores[key] = round((float(scores.get(key, 0.0)) + g[key]) / 2.0, 4)
                hurt_comfort = float(g.get("hurt_comfort", 0.0))
                dark = float(g.get("dark", 0.0))
            else:
                hurt_comfort = 0.0
                dark = 0.0

            # Derived tags enrich the embed text → better semantic vector.
            embed_tags = tags + [t for t in derived_tags if t not in tags]
            embed_text = _build_embed_text(page.name, fandoms, pairings, embed_tags, description)
            text_hash = hashlib.sha256(embed_text.encode("utf-8")).hexdigest()

            vectors = await embed_client.embed_texts([embed_text], http=http)
            vec = vectors[0] if vectors else None

            async with AsyncSessionLocal() as db:
                if vec is not None:
                    # Schema drift: tags & pairings are `json` columns,
                    # fandoms is `varchar[]`. Bind each to its real type —
                    # json columns get a JSON string via ::json cast, the
                    # array column gets a typed ARRAY(String) bindparam.
                    import json as _json
                    from sqlalchemy import bindparam, String as SAString
                    from sqlalchemy.dialects.postgresql import ARRAY as PGARRAY
                    vec_literal = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
                    stmt = text(
                        "UPDATE fanfics SET "
                        "  embedding_vec = :vec, "
                        "  tags = CAST(:tags AS json), pairings = CAST(:pairings AS json), "
                        "  fandoms = :fandoms, "
                        "  description = :descr, "
                        "  romance_score=:romance, angst_score=:angst, fluff_score=:fluff, "
                        "  drama_score=:drama, humor_score=:humor, adventure_score=:adventure, "
                        "  mystery_score=:mystery, emotional_intensity=:ei, narrative_depth=:nd, "
                        "  hurt_comfort_score=:hc, dark_score=:dark, "
                        "  derived_tags=CAST(:derived AS json), llm_mood=:mood, "
                        "  llm_audience=:audience, "
                        "  llm_enriched_at = CASE WHEN :llm_ok THEN now() ELSE llm_enriched_at END, "
                        "  embed_text_hash=:hash, embedded_at=now(), "
                        "  enrichment_status='enriched', enrichment_error=NULL "
                        "WHERE id = :id"
                    ).bindparams(bindparam("fandoms", type_=PGARRAY(SAString)))
                    await db.execute(stmt, {
                        "vec": vec_literal, "id": fid,
                        "tags": _json.dumps(tags, ensure_ascii=False),
                        "pairings": _json.dumps(pairings, ensure_ascii=False),
                        "fandoms": fandoms,
                        "descr": description[:4000],
                        "romance": scores["romance"], "angst": scores["angst"],
                        "fluff": scores["fluff"], "drama": scores["drama"],
                        "humor": scores["humor"], "adventure": scores["adventure"],
                        "mystery": scores["mystery"], "ei": scores["emotional_intensity"],
                        "nd": scores["narrative_depth"], "hash": text_hash,
                        "hc": hurt_comfort, "dark": dark,
                        "derived": _json.dumps(derived_tags, ensure_ascii=False),
                        "mood": llm_mood, "audience": llm_audience,
                        "llm_ok": llm is not None,
                    })
                    await db.commit()
                    enriched += 1
                else:
                    # Embedding failed — bump attempts, keep pending for retry.
                    await db.execute(text(
                        "UPDATE fanfics SET enrichment_attempts = enrichment_attempts + 1, "
                        "enrichment_error = 'embed failed', "
                        "enrichment_status = CASE WHEN enrichment_attempts + 1 >= 3 THEN 'failed' ELSE 'pending' END "
                        "WHERE id = :id"
                    ), {"id": fid})
                    await db.commit()
                    failed += 1
        except Exception as e:
            logger.warning("enrich failed for %s: %s", fid, e)
            if first_error is None:
                first_error = f"{type(e).__name__}: {str(e)[:300]}"
            try:
                async with AsyncSessionLocal() as db:
                    await db.execute(text(
                        "UPDATE fanfics SET enrichment_attempts = enrichment_attempts + 1, "
                        "enrichment_error = :err, "
                        "enrichment_status = CASE WHEN enrichment_attempts + 1 >= 3 THEN 'failed' ELSE 'pending' END "
                        "WHERE id = :id"
                    ), {"id": fid, "err": str(e)[:500]})
                    await db.commit()
            except Exception as e2:
                if first_error is None:
                    first_error = f"write-error {type(e2).__name__}: {str(e2)[:300]}"
            failed += 1

    return {"processed": processed, "enriched": enriched, "failed": failed, "first_error": first_error}
