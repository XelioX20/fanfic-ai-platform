"""Client for the Cloudflare Worker /embed endpoint (bge-m3, 1024-dim).

Render calls this to vectorize fanfic text. Embeddings run on Workers AI
at the edge (no torch on Render's 512MB dyno). Returns L2-normalizable
float lists; the caller writes them to fanfics.embedding_vec (halfvec).
"""
from __future__ import annotations
import logging
import httpx
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(settings.EMBED_WORKER_URL and settings.EMBED_WORKER_SECRET)


async def embed_texts(texts: list[str], http: Optional[httpx.AsyncClient] = None) -> Optional[list[list[float]]]:
    """Return one 1024-dim vector per input text, or None on failure.

    Batches all texts in a single Worker call. bge-m3 handles arrays.
    """
    if not is_configured():
        logger.warning("embed_texts called but EMBED_WORKER_* not configured")
        return None
    if not texts:
        return []

    url = settings.EMBED_WORKER_URL.rstrip("/") + "/embed"
    headers = {"X-Embed-Secret": settings.EMBED_WORKER_SECRET, "Content-Type": "application/json"}

    async def _do(client: httpx.AsyncClient) -> Optional[list[list[float]]]:
        resp = await client.post(url, json={"texts": texts}, headers=headers, timeout=60.0)
        if resp.status_code != 200:
            logger.warning("embed worker returned %d: %s", resp.status_code, resp.text[:200])
            return None
        data = resp.json()
        vectors = data.get("vectors")
        if not isinstance(vectors, list) or len(vectors) != len(texts):
            logger.warning("embed worker vector count mismatch: got %s for %d texts",
                           len(vectors) if isinstance(vectors, list) else "?", len(texts))
            return None
        return vectors

    try:
        if http is not None:
            return await _do(http)
        async with httpx.AsyncClient() as client:
            return await _do(client)
    except httpx.HTTPError as e:
        logger.warning("embed worker request failed: %s", e)
        return None
