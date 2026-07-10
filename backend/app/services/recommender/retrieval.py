"""Candidate retrieval — a single pgvector ANN query.

Given the user's taste vector, fetch the top-N most semantically similar
fics via the HNSW cosine index, excluding already-read ids and applying
optional rating/direction filters. Returns rows with all the features
rerank.py needs. This is the ONE place the catalog's embeddings are
touched, and it stays entirely in Postgres.
"""
from __future__ import annotations
import logging
from typing import Optional
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def because_you_read(
    user_id: str,
    candidate_ids: list[str],
) -> dict[str, dict]:
    """For each candidate fic, find the user's most-similar already-read fic
    → {candidate_id: {"because_id", "because_title", "sim"}}.

    Powers the "потому что вы читали X" line. Pure pgvector: a LATERAL join
    picks the nearest read fic per candidate in one query — no LLM, no
    per-card round-trip. Only returns entries where a read fic with an
    embedding exists and similarity clears a floor (0.30) so we never show
    a spurious reason."""
    if not candidate_ids:
        return {}
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(text("""
            WITH read_fics AS (
                SELECT DISTINCT s.fanfic_id
                FROM (
                    SELECT fanfic_id FROM user_bookmarks     WHERE user_id = :uid
                    UNION SELECT fanfic_id FROM user_anchors       WHERE user_id = :uid
                    UNION SELECT fanfic_id FROM user_local_history WHERE user_id = :uid
                ) s
            )
            SELECT c.id AS cand_id, nn.rid AS because_id, nn.rtitle AS because_title,
                   nn.sim AS sim
            FROM fanfics c
            CROSS JOIN LATERAL (
                SELECT rf_f.id AS rid, rf_f.title AS rtitle,
                       1 - (c.embedding_vec <=> rf_f.embedding_vec) AS sim
                FROM read_fics rf
                JOIN fanfics rf_f ON rf_f.id = rf.fanfic_id
                WHERE rf_f.embedding_vec IS NOT NULL
                  AND rf_f.id <> c.id
                ORDER BY c.embedding_vec <=> rf_f.embedding_vec
                LIMIT 1
            ) nn
            WHERE c.id = ANY(:cids) AND c.embedding_vec IS NOT NULL
        """), {"uid": user_id, "cids": candidate_ids})).mappings().all()
        out: dict[str, dict] = {}
        for r in rows:
            if float(r["sim"] or 0.0) >= 0.30:
                out[r["cand_id"]] = {
                    "because_id": r["because_id"],
                    "because_title": r["because_title"],
                    "sim": round(float(r["sim"]), 4),
                }
        return out


async def retrieve_by_centroid(
    centroid: list[float],
    *,
    limit: int = 60,
    exclude_ids: Optional[list[str]] = None,
) -> list[dict]:
    """ANN query against an explicit centroid vector (used per-facet).
    Same shape as retrieve_candidates but the vector is passed in rather
    than read from user_taste_vectors."""
    exclude_ids = exclude_ids or []
    if not centroid:
        return []
    taste_literal = "[" + ",".join(f"{x:.6f}" for x in centroid) + "]"
    params: dict = {"taste": taste_literal, "lim": limit}
    exclude_clause = ""
    if exclude_ids:
        exclude_clause = "AND f.id <> ALL(:excl)"
        params["excl"] = exclude_ids
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(text(f"""
            SELECT f.id, f.title, f.author_name, f.cover_url, f.direction,
                   f.rating, f.completion_status, f.fandoms, f.tags,
                   f.likes, f.trophies, f.comments_count, f.words_count,
                   f.writing_quality,
                   f.romance_score, f.angst_score, f.fluff_score, f.drama_score,
                   f.humor_score, f.adventure_score, f.mystery_score,
                   EXTRACT(EPOCH FROM (now() - COALESCE(f.updated_at, f.scraped_at))) / 86400.0 AS age_days,
                   1 - (f.embedding_vec <=> CAST(:taste AS halfvec)) AS sim
            FROM fanfics f
            WHERE f.embedding_vec IS NOT NULL
              AND f.enrichment_status = 'enriched'
              {exclude_clause}
            ORDER BY f.embedding_vec <=> CAST(:taste AS halfvec)
            LIMIT :lim
        """), params)).mappings().all()
        return [dict(r) for r in rows]


async def retrieve_candidates(
    user_id: str,
    *,
    limit: int = 300,
    exclude_ids: Optional[list[str]] = None,
) -> list[dict]:
    """Return up to `limit` candidate fics ranked by cosine similarity to
    the user's taste vector. Empty list if the user has no taste vector."""
    exclude_ids = exclude_ids or []

    async with AsyncSessionLocal() as db:
        # Does the user have a taste vector?
        tv = (await db.execute(
            text("SELECT vec::vector::text FROM user_taste_vectors WHERE user_id = :uid"),
            {"uid": user_id},
        )).first()
        if not tv or not tv[0]:
            return []
        taste_literal = tv[0]

        # Single ANN query. `<=>` is cosine distance on halfvec; 1-dist = sim.
        # Exclude already-signalled fics (passed in) so we don't recommend
        # what they've read. HNSW index handles the ORDER BY efficiently.
        # Cast the taste literal to halfvec to match the column type.
        exclude_clause = ""
        params: dict = {"taste": taste_literal, "lim": limit}
        if exclude_ids:
            exclude_clause = "AND f.id <> ALL(:excl)"
            params["excl"] = exclude_ids

        rows = (await db.execute(text(f"""
            SELECT f.id, f.title, f.author_name, f.cover_url, f.direction,
                   f.rating, f.completion_status, f.fandoms, f.tags,
                   f.likes, f.trophies, f.comments_count, f.words_count,
                   f.writing_quality,
                   f.romance_score, f.angst_score, f.fluff_score, f.drama_score,
                   f.humor_score, f.adventure_score, f.mystery_score,
                   EXTRACT(EPOCH FROM (now() - COALESCE(f.updated_at, f.scraped_at))) / 86400.0 AS age_days,
                   1 - (f.embedding_vec <=> CAST(:taste AS halfvec)) AS sim
            FROM fanfics f
            WHERE f.embedding_vec IS NOT NULL
              AND f.enrichment_status = 'enriched'
              {exclude_clause}
            ORDER BY f.embedding_vec <=> CAST(:taste AS halfvec)
            LIMIT :lim
        """), params)).mappings().all()

        return [dict(r) for r in rows]
