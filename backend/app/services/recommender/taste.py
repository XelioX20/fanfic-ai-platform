"""User taste vector(s) — the heart of the recommendation feed.

Two builders share one signal-gathering step:
  build_taste_vector(user_id)  → single mean vector (M=1), the always-safe
                                 fallback + the "For You" row.
  build_facets(user_id)        → M∈{1..5} spherical-k-means centroids over
                                 the user's read-fic vectors, each labelled
                                 by its dominant tags → multi-row feed
                                 ("More dark drama", "More fluffy romance").

Signal strengths (engage): bookmark 1.0, anchor 0.7, history 0.3, plus a
scroll-depth term and a visit bonus (see 4.1). Recency: 75-day half-life.
Combined per-fic weight:
    w_i = (engage + scroll_weight(max_p) + 0.6*log1p(visits)) * recency

Compute is in Python because only the user's own signalled fics (tens of
rows) are pulled — never the catalog.
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
_ENGAGE = {"bookmark": 1.0, "anchor": 0.7, "history": 0.3}

# Facet clustering knobs
_MIN_SIGNALS_FOR_FACETS = 8      # below this, single mean only
_MAX_FACETS = 5
_MIN_FACET_MASS_FRAC = 0.15      # a facet holding <15% of mass merges away
_KMEANS_ITERS = 25


def _scroll_weight(p: float) -> float:
    """max scroll depth (0..1) → additive engagement weight.
    Bounce deadzone <10% → 0; concave core^0.6 rewards depth; +0.25 at ≥95%."""
    if p < 0.10:
        return 0.0
    core = (p - 0.10) / 0.90
    base = core ** 0.6
    return base + (0.25 if p >= 0.95 else 0.0)


def _normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def _cos(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))  # both assumed unit-normalized


async def _gather_signals(db, user_id: str) -> list[dict]:
    """Return the user's signalled fics with weight, unit vector, and tags.
    One row per fic. Empty list on cold start."""
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
        prog AS (
            SELECT fanfic_id, MAX(max_progress) AS max_p, SUM(visits) AS visits
            FROM user_reading_progress WHERE user_id = :uid GROUP BY fanfic_id
        )
        SELECT a.engage,
               EXTRACT(EPOCH FROM (now() - a.ts)) / 86400.0 AS age_days,
               COALESCE(p.max_p, 0.0) AS max_p,
               COALESCE(p.visits, 0)  AS visits,
               (f.embedding_vec::vector)::text AS vec,
               f.tags
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

    out: list[dict] = []
    dim = 0
    for engage, age_days, max_p, visits, vec_text, tags in rows:
        vals = [float(x) for x in vec_text.strip("[]").split(",")]
        if not dim:
            dim = len(vals)
        elif len(vals) != dim:
            continue
        recency = math.exp(-_LAMBDA * max(0.0, float(age_days)))
        w = (float(engage) + _scroll_weight(float(max_p or 0.0))
             + 0.6 * math.log1p(float(visits or 0))) * recency
        # tags may be a json string or list depending on driver
        t = tags
        if isinstance(t, str):
            try:
                import json as _j
                t = _j.loads(t)
            except Exception:
                t = []
        out.append({"w": w, "vec": _normalize(vals), "tags": t or []})
    return out


def _weighted_mean(items: list[dict]) -> list[float]:
    dim = len(items[0]["vec"])
    acc = [0.0] * dim
    for it in items:
        w, v = it["w"], it["vec"]
        for i in range(dim):
            acc[i] += w * v[i]
    return _normalize(acc)


def _spherical_kmeans(items: list[dict], k: int) -> list[list[int]]:
    """Weighted spherical k-means on unit vectors. Returns clusters as lists
    of item indices. Deterministic seeding (k-means++-ish by max distance)
    so no RNG (matches the no-Math.random constraint elsewhere)."""
    n = len(items)
    if k <= 1 or n <= k:
        return [list(range(n))]
    vecs = [it["vec"] for it in items]

    # Deterministic seed: first centroid = highest-weight item, then each
    # next = item farthest (lowest max-cos) from chosen centroids.
    seed_order = sorted(range(n), key=lambda i: -items[i]["w"])
    centroids = [vecs[seed_order[0]]]
    while len(centroids) < k:
        best_i, best_d = None, 2.0
        for i in range(n):
            d = max(_cos(vecs[i], c) for c in centroids)  # similarity to nearest centroid
            if d < best_d:
                best_d, best_i = d, i
        centroids.append(vecs[best_i])

    assign = [0] * n
    for _ in range(_KMEANS_ITERS):
        changed = False
        for i in range(n):
            sims = [_cos(vecs[i], c) for c in centroids]
            a = max(range(k), key=lambda j: sims[j])
            if a != assign[i]:
                assign[i] = a
                changed = True
        # recompute weighted centroids
        for j in range(k):
            members = [items[i] for i in range(n) if assign[i] == j]
            if members:
                centroids[j] = _weighted_mean(members)
        if not changed:
            break

    clusters: list[list[int]] = [[] for _ in range(k)]
    for i in range(n):
        clusters[assign[i]].append(i)
    return [c for c in clusters if c]


def _label_facet(members: list[dict]) -> tuple[str, dict]:
    """Weighted-tag TF label for a facet: top tags by summed weight.
    Returns (label, tag_scores)."""
    tag_w: dict[str, float] = {}
    for it in members:
        for tag in it["tags"]:
            tag_w[str(tag)] = tag_w.get(str(tag), 0.0) + it["w"]
    top = sorted(tag_w.items(), key=lambda kv: -kv[1])[:2]
    if not top:
        return ("Ещё в этом духе", {})
    names = " · ".join(t[0] for t in top)
    return (f"Ещё: {names}", dict(sorted(tag_w.items(), key=lambda kv: -kv[1])[:8]))


async def build_taste_vector(user_id: str) -> Optional[dict]:
    """Single mean vector (M=1). The always-safe path + 'For You' row."""
    async with AsyncSessionLocal() as db:
        items = await _gather_signals(db, user_id)
        if not items:
            return None
        vec = _weighted_mean(items)
        vec_literal = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
        await db.execute(text("""
            INSERT INTO user_taste_vectors (user_id, vec, n_signals, built_at)
            VALUES (:uid, :vec, :n, now())
            ON CONFLICT (user_id) DO UPDATE
              SET vec = EXCLUDED.vec, n_signals = EXCLUDED.n_signals, built_at = now()
        """), {"uid": user_id, "vec": vec_literal, "n": len(items)})
        await db.commit()
        return {"n_signals": len(items), "dim": len(vec)}


async def build_facets(user_id: str) -> Optional[list[dict]]:
    """Multi-facet taste: cluster the user's reads, return labelled facets
    [{centroid:[...], mass, label, tag_scores}]. Falls back to a single
    facet (the mean) when signals are few or clustering doesn't improve.
    Also persists them to user_taste_vectors.facets + the mean to vec.
    Returns None on cold start."""
    async with AsyncSessionLocal() as db:
        items = await _gather_signals(db, user_id)
        if not items:
            return None

        mean_vec = _weighted_mean(items)
        total_mass = sum(it["w"] for it in items) or 1.0

        # Decide M.
        facets: list[dict]
        if len(items) < _MIN_SIGNALS_FOR_FACETS:
            facets = [{
                "centroid": mean_vec, "mass": 1.0,
                **dict(zip(("label", "tag_scores"), _label_facet(items))),
            }]
        else:
            best = None
            for k in range(2, min(_MAX_FACETS, len(items) // 3) + 1):
                clusters = _spherical_kmeans(items, k)
                if len(clusters) < 2:
                    continue
                # Silhouette-ish: mean intra-cluster cos minus nearest-other.
                score = _cluster_quality(items, clusters)
                if best is None or score > best[0]:
                    best = (score, clusters)
            # single-mean baseline quality
            base_score = _cluster_quality(items, [list(range(len(items)))])
            if best and best[0] > base_score + 0.03:
                clusters = best[1]
                facets = []
                for cl in clusters:
                    members = [items[i] for i in cl]
                    mass = sum(m["w"] for m in members) / total_mass
                    if mass < _MIN_FACET_MASS_FRAC:
                        continue  # too small — its items still count via other facets' ANN overlap
                    label, tag_scores = _label_facet(members)
                    facets.append({
                        "centroid": _weighted_mean(members),
                        "mass": round(mass, 4),
                        "label": label,
                        "tag_scores": {k2: round(v2, 3) for k2, v2 in tag_scores.items()},
                    })
                if not facets:
                    facets = [{"centroid": mean_vec, "mass": 1.0,
                               **dict(zip(("label", "tag_scores"), _label_facet(items)))}]
            else:
                facets = [{"centroid": mean_vec, "mass": 1.0,
                           **dict(zip(("label", "tag_scores"), _label_facet(items)))}]

        # Persist: mean to vec (compat), facets to jsonb (centroids stored
        # as plain lists — retrieval casts them to halfvec at query time).
        import json as _j
        mean_literal = "[" + ",".join(f"{x:.6f}" for x in mean_vec) + "]"
        await db.execute(text("""
            INSERT INTO user_taste_vectors (user_id, vec, facets, n_signals, built_at)
            VALUES (:uid, :vec, CAST(:facets AS json), :n, now())
            ON CONFLICT (user_id) DO UPDATE
              SET vec = EXCLUDED.vec, facets = EXCLUDED.facets,
                  n_signals = EXCLUDED.n_signals, built_at = now()
        """), {
            "uid": user_id, "vec": mean_literal,
            "facets": _j.dumps(facets), "n": len(items),
        })
        await db.commit()
        return facets


def _cluster_quality(items: list[dict], clusters: list[list[int]]) -> float:
    """Mean within-cluster cosine to own centroid (higher = tighter).
    Cheap proxy for silhouette; enough to decide if splitting helps."""
    if len(clusters) < 2:
        # single cluster: cohesion around the mean
        vecs = [it["vec"] for it in items]
        c = _weighted_mean(items)
        return sum(_cos(v, c) for v in vecs) / len(vecs)
    total, count = 0.0, 0
    for cl in clusters:
        members = [items[i] for i in cl]
        if not members:
            continue
        c = _weighted_mean(members)
        for m in members:
            total += _cos(m["vec"], c)
            count += 1
    return total / count if count else 0.0
