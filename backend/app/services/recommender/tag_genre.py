"""Deterministic Russian tag → genre-score mapping.

Phase 2 (v1) enrichment computes genre/vibe scores WITHOUT an LLM — a
hand-built lexicon maps ficbook's Russian tags/direction to the numeric
`*_score` columns on the Fanfic model. These feed the rerank stage as
secondary features (cosine similarity stays the primary signal). An LLM
overlay can overwrite these later (Phase 5) but the feed works fully
without it.

Scores are 0..1, additive-then-clamped across matched tags.
"""
from __future__ import annotations
from typing import Iterable

# Substring → {genre: weight}. Matching is case-insensitive substring so
# "Флафф и юмор" hits both fluff and humor. Keep keys lowercase.
_LEXICON: dict[str, dict[str, float]] = {
    # fluff / comfort
    "флафф": {"fluff": 1.0},
    "флаффный": {"fluff": 1.0},
    "уют": {"fluff": 0.6},
    "hurt/comfort": {"fluff": 0.4, "angst": 0.5, "emotional_intensity": 0.5},
    "хёрт/комфорт": {"fluff": 0.4, "angst": 0.5, "emotional_intensity": 0.5},
    "забота": {"fluff": 0.6},
    # angst / dark
    "ангст": {"angst": 1.0, "emotional_intensity": 0.7},
    "дарк": {"angst": 0.7, "emotional_intensity": 0.8},
    "драма": {"drama": 1.0, "emotional_intensity": 0.6},
    "трагедия": {"angst": 0.8, "drama": 0.7, "emotional_intensity": 0.9},
    "смерть персонажа": {"angst": 0.7, "drama": 0.6, "emotional_intensity": 0.8},
    "страдания": {"angst": 0.8, "emotional_intensity": 0.7},
    "психология": {"narrative_depth": 0.7, "emotional_intensity": 0.5},
    # humor
    "юмор": {"humor": 1.0},
    "стёб": {"humor": 0.9},
    "комедия": {"humor": 1.0},
    "крэк": {"humor": 0.8},
    "пародия": {"humor": 0.7},
    # romance
    "романтика": {"romance": 1.0},
    "первый поцелуй": {"romance": 0.7, "fluff": 0.4},
    "признание в любви": {"romance": 0.8, "fluff": 0.3},
    "отношения": {"romance": 0.5},
    "влюблённость": {"romance": 0.8},
    "свадьба": {"romance": 0.6, "fluff": 0.4},
    # adventure / action
    "приключения": {"adventure": 1.0},
    "экшн": {"adventure": 0.8},
    "боевик": {"adventure": 0.8},
    "путешествия": {"adventure": 0.7},
    "фэнтези": {"adventure": 0.5, "narrative_depth": 0.4},
    "война": {"adventure": 0.5, "drama": 0.5, "emotional_intensity": 0.6},
    # mystery / thriller
    "детектив": {"mystery": 1.0},
    "триллер": {"mystery": 0.8, "emotional_intensity": 0.6},
    "мистика": {"mystery": 0.7},
    "загадка": {"mystery": 0.8},
    "расследование": {"mystery": 0.9},
    "хоррор": {"mystery": 0.5, "angst": 0.5, "emotional_intensity": 0.8},
    # depth / quality hints
    "философия": {"narrative_depth": 0.8},
    "макси": {"narrative_depth": 0.4},
    "ангуст": {"angst": 0.9, "emotional_intensity": 0.6},  # common misspelling
}

_GENRES = (
    "romance", "angst", "fluff", "drama", "humor", "adventure", "mystery",
    "emotional_intensity", "narrative_depth",
)


def score_from_tags(tags: Iterable[str], direction: str = "", description: str = "") -> dict[str, float]:
    """Return {genre: score(0..1)} from tags + direction + description text.

    All matched weights per genre are summed then clamped to 1.0. Missing
    genres are returned as 0.0 so callers get a complete profile.
    """
    acc: dict[str, float] = {g: 0.0 for g in _GENRES}

    # Build one lowercase haystack from tags + description for substring match.
    hay_parts = [str(t).lower() for t in (tags or [])]
    if description:
        hay_parts.append(description.lower())
    haystack = " | ".join(hay_parts)

    for key, weights in _LEXICON.items():
        if key in haystack:
            for genre, w in weights.items():
                acc[genre] = min(1.0, acc[genre] + w)

    # writing_quality has no direct tag signal in v1 — leave for LLM phase.
    # Provide a weak prior from length hint if present.
    return acc
