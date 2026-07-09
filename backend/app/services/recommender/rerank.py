"""Rerank + MMR diversification of retrieved candidates.

rerank_score(i) = 0.55*sim + 0.25*engagement + 0.15*quality
                + 0.05*freshness - 0.10*popularity_penalty
each term min-max normalized across the candidate set so no single raw
count dominates. Then MMR trims to the final feed, penalizing items too
similar to ones already picked and capping per-fandom dominance.
"""
from __future__ import annotations
import math
from typing import Optional


def _minmax(values: list[float]) -> list[float]:
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        return [0.5 for _ in values]  # all equal → neutral
    return [(v - lo) / (hi - lo) for v in values]


def rerank(candidates: list[dict]) -> list[dict]:
    """Attach a `score` to each candidate (0..1) from the weighted formula.
    Mutates + returns the list sorted by score desc."""
    if not candidates:
        return []

    sims = [float(c.get("sim") or 0.0) for c in candidates]

    # Engagement: ratio-based, not raw counts, so old megafics don't win by
    # accumulated age. likes-per-comment + log(likes).
    def _eng(c: dict) -> float:
        likes = float(c.get("likes") or 0)
        comments = float(c.get("comments_count") or 0)
        return math.log1p(likes) + (likes / max(comments, 1.0)) * 0.1
    engs = [_eng(c) for c in candidates]

    # Quality: writing_quality (0..1 if set) + completion bonus.
    def _qual(c: dict) -> float:
        wq = c.get("writing_quality")
        q = float(wq) if wq is not None else 0.3
        if (c.get("completion_status") or "").lower().startswith(("заверш", "complete")):
            q += 0.2
        return q
    quals = [_qual(c) for c in candidates]

    # Freshness: newer = higher. exp(-age/180d).
    freshes = [math.exp(-float(c.get("age_days") or 0.0) / 180.0) for c in candidates]

    # Popularity (for the penalty term): log(likes).
    pops = [math.log1p(float(c.get("likes") or 0)) for c in candidates]

    n_sims, n_engs, n_quals, n_fresh, n_pops = (
        _minmax(sims), _minmax(engs), _minmax(quals), _minmax(freshes), _minmax(pops),
    )

    for i, c in enumerate(candidates):
        c["score"] = (
            0.55 * n_sims[i]
            + 0.25 * n_engs[i]
            + 0.15 * n_quals[i]
            + 0.05 * n_fresh[i]
            - 0.10 * n_pops[i]
        )
    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates


def _primary_fandom(c: dict) -> Optional[str]:
    f = c.get("fandoms")
    if isinstance(f, list) and f:
        return str(f[0])
    return None


def mmr_diversify(
    candidates: list[dict],
    *,
    k: int = 30,
    fandom_cap: int = 4,
) -> list[dict]:
    """Greedy selection favouring high score but capping how many items
    from the same primary fandom appear, so the feed isn't one-fandom
    mush. Candidates must already be rerank-scored + sorted.

    Without stored candidate-candidate similarity we approximate MMR's
    redundancy term with a per-fandom count penalty — cheap and effective
    for the 'not all Harry Potter' goal.
    """
    picked: list[dict] = []
    fandom_counts: dict[str, int] = {}

    # Iterate score-desc; skip items whose fandom already hit the cap until
    # we've filled k or exhausted candidates.
    overflow: list[dict] = []
    for c in candidates:
        if len(picked) >= k:
            break
        fam = _primary_fandom(c) or "∅"
        if fandom_counts.get(fam, 0) >= fandom_cap:
            overflow.append(c)
            continue
        picked.append(c)
        fandom_counts[fam] = fandom_counts.get(fam, 0) + 1

    # If we couldn't fill k because of caps, top up from overflow (best first).
    if len(picked) < k:
        picked.extend(overflow[: k - len(picked)])

    return picked[:k]
