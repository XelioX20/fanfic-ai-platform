"""User taste vector — the heart of the recommendation feed.

Builds a single 1024-dim vector representing what a user likes, from their
reading signals weighted by (a) signal strength and (b) recency.

Signal strengths (engage_i):
    bookmark      1.0   explicit favourite
    anchor        0.7   read far enough to drop a marker
    history-open  0.3   opened the page

Recency: exp(-lambda * age_days), lambda = ln2 / 75  (75-day half-life).
Combined weight: w_i = recency * (1 + beta * engage), beta = 1.0.

taste = normalize( sum_i w_i * embedding_i ).

Note on compute: we fetch only the user's OWN signalled fics (tens of
rows, not the catalog), so pulling those vectors into Python for the
weighted mean is cheap. The "no embeddings in Python" rule applies to the
thousands-strong catalog, retrieved in Phase-3 retrieval.py via a single
pgvector ANN query — not here.
"""
from __future__ import annotations
import logging
import math
from typing import Optional
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)

_HALF_LIFE_DAYS = 75.0
_LAMBDA = math.log(2) / _HALF_LIFE_DAYS
_BETA = 1.0
_ENGAGE = {"bookmark": 1.0, "anchor": 0.7, "history": 0.3}


def _scroll_weight(p: float) -> float:
    """Map max scroll depth (0..1) → an additive engagement weight.
    Bounce deadzone below 10% returns 0; a concave curve rewards depth so
    'read to the end' dominates 'skimmed a bit'; +0.25 completion bonus."""
    if p < 0.10:
        return 0.0
    core = (p - 0.10) / 0.90
    base = core ** 0.6
    return base + (0.25 if p >= 0.95 else 0.0)


async def build_taste_vector(user_id: str) -> Optional[dict]:
    """Compute + persist the user's taste vector. Returns {n_signals, dim}
    or None on cold start (no signalled fics with embeddings yet)."""
    async with AsyncSessionLocal() as db:
        # Gather the user's signalled fics (max engage, latest ts) joined to
        # fics that have an embedding. Return the vector as a CSV string
        # (embedding_vec::vector::text gives '[a,b,...]').
        rows = (await db.execute(text("""
            WITH signals AS (
                SELECT fanfic_id, CAST(:w_bookmark AS float) AS engage, added_at   AS ts FROM user_bookmarks     WHERE user_id = :uid
                UNION ALL
                SELECT fanfic_id, CAST(:w_anchor AS float)   AS engage, updated_at AS ts FROM user_anchors       WHERE user_id = :uid
                UNION ALL
                SELECT fanfic_id, CAST(:w_history AS float)  AS engage, opened_at  AS ts FROM user_local_history WHERE user_id = :uid
            ),
            agg AS (
                SELECT fanfic_id, MAX(engage) AS engage, MAX(ts) AS ts
                FROM signals GROUP BY fanfic_id
            ),
            -- Per-fic scroll depth: strongest chapter progress + total visits.
            prog AS (
                SELECT fanfic_id, MAX(max_progress) AS max_p, SUM(visits) AS visits
                FROM user_reading_progress WHERE user_id = :uid GROUP BY fanfic_id
            )
            SELECT a.engage,
                   EXTRACT(EPOCH FROM (now() - a.ts)) / 86400.0 AS age_days,
                   COALESCE(p.max_p, 0.0) AS max_p,
                   COALESCE(p.visits, 0)  AS visits,
                   (f.embedding_vec::vector)::text AS vec
            FROM agg a
            LEFT JOIN prog p ON p.fanfic_id = a.fanfic_id
            JOIN fanfics f ON f.id = a.fanfic_id
            WHERE f.embedding_vec IS NOT NULL
        """), {
            "uid": user_id,
            "w_bookmark": _ENGAGE["bookmark"],
            "w_anchor": _ENGAGE["anchor"],
            "w_history": _ENGAGE["history"],
        })).all()

        if not rows:
            return None

        # Weighted sum in Python (tens of vectors, cheap).
        dim = 0
        acc: list[float] = []
        for engage, age_days, max_p, visits, vec_text in rows:
            vals = [float(x) for x in vec_text.strip("[]").split(",")]
            if not acc:
                dim = len(vals)
                acc = [0.0] * dim
            elif len(vals) != dim:
                continue  # skip a malformed row
            recency = math.exp(-_LAMBDA * max(0.0, float(age_days)))
            # Scroll depth folded in: concave reward for depth + completion
            # bonus. A bounce (p < 0.10) contributes 0 (not negative — "not
            # in the mood" ≠ "dislikes the genre").
            sw = _scroll_weight(float(max_p or 0.0))
            visit_bonus = 0.6 * math.log1p(float(visits or 0))
            w = (float(engage) + sw + visit_bonus) * recency
            for i in range(dim):
                acc[i] += w * vals[i]

        if not acc:
            return None

        norm = math.sqrt(sum(x * x for x in acc)) or 1.0
        vec = [x / norm for x in acc]
        vec_literal = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"

        await db.execute(text("""
            INSERT INTO user_taste_vectors (user_id, vec, n_signals, built_at)
            VALUES (:uid, :vec, :n, now())
            ON CONFLICT (user_id) DO UPDATE
              SET vec = EXCLUDED.vec, n_signals = EXCLUDED.n_signals, built_at = now()
        """), {"uid": user_id, "vec": vec_literal, "n": len(rows)})
        await db.commit()

        return {"n_signals": len(rows), "dim": len(vec)}
