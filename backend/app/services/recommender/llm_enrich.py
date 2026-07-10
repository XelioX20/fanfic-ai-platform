"""LLM enrichment client — calls the Cloudflare Worker /enrich-llm endpoint.

Runs Llama 3.3 70B (Workers AI) as a content classifier over fanfic
METADATA (title + fandoms + pairings + tags + description — never full
chapter text). Returns derived tags, per-genre intensity scores, mood, and
an audience sketch that refine the deterministic tag_genre scores.

Best-effort by design: any failure returns None and the caller keeps the
deterministic scores. Never raises to the enrichment loop.
"""
from __future__ import annotations
import logging
from typing import Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# The LLM path reuses the embed worker URL host + secret. EMBED_WORKER_URL
# points at the /embed path; we swap the trailing segment for /enrich-llm.
_GENRE_KEYS = (
    "romance", "angst", "fluff", "drama", "humor",
    "adventure", "mystery", "hurt_comfort", "dark",
)


def is_configured() -> bool:
    return bool(settings.EMBED_WORKER_URL and settings.EMBED_WORKER_SECRET)


def _endpoint() -> str:
    base = settings.EMBED_WORKER_URL.rstrip("/")
    # EMBED_WORKER_URL is ".../embed"; derive sibling ".../enrich-llm".
    if base.endswith("/embed"):
        return base[: -len("/embed")] + "/enrich-llm"
    return base + "/enrich-llm"


async def enrich_llm(
    *,
    title: str,
    fandoms: Optional[list[str]] = None,
    pairings: Optional[list[str]] = None,
    tags: Optional[list[str]] = None,
    description: str = "",
    http: httpx.AsyncClient,
) -> Optional[dict]:
    """Return {derived_tags:[...], genres:{...0..1}, mood, audience} or None.

    Clamps genre values to 0..1 and coerces types defensively — the LLM
    mostly honours the JSON schema but we never trust it blindly."""
    if not is_configured():
        return None
    try:
        resp = await http.post(
            _endpoint(),
            headers={"X-Embed-Secret": settings.EMBED_WORKER_SECRET},
            json={
                "title": title or "",
                "fandoms": fandoms or [],
                "pairings": pairings or [],
                "tags": tags or [],
                "description": (description or "")[:2000],
            },
            timeout=45.0,
        )
        resp.raise_for_status()
        data = resp.json()
        result = data.get("result")
        if not isinstance(result, dict):
            return None

        # Normalize genres → dict of clamped floats.
        raw_genres = result.get("genres") or {}
        genres: dict[str, float] = {}
        if isinstance(raw_genres, dict):
            for k in _GENRE_KEYS:
                v = raw_genres.get(k)
                try:
                    fv = float(v)
                except (TypeError, ValueError):
                    fv = 0.0
                genres[k] = max(0.0, min(1.0, fv))

        derived = result.get("derived_tags") or []
        if not isinstance(derived, list):
            derived = []
        derived = [str(t).strip() for t in derived if str(t).strip()][:12]

        return {
            "derived_tags": derived,
            "genres": genres,
            "mood": str(result.get("mood") or "")[:64],
            "audience": str(result.get("audience") or "")[:200],
        }
    except Exception as e:
        logger.info("enrich_llm failed (non-fatal): %s", e)
        return None
