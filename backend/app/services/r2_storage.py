"""Cloudflare R2 storage adapter for user avatars.

Uses the Cloudflare API directly (no S3 SDK) so we can auth with a
standard Bearer token instead of provisioning permanent S3-style Access
Keys through the dashboard. This keeps the whole setup in five env vars.

R2 documented HTTP endpoints:
  PUT    /accounts/{account_id}/r2/buckets/{bucket}/objects/{key}
  DELETE /accounts/{account_id}/r2/buckets/{bucket}/objects/{key}

Objects are addressed as `avatars/{user_id}.{ext}` inside the bucket;
the public URL served to the browser is
`{R2_PUBLIC_URL}/avatars/{user_id}.{ext}`.

The module is optional — if any of the R2_* vars is empty, `is_enabled()`
returns False and callers fall back to storing the base64 data-URL in
the users.custom_avatar_url TEXT column.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_enabled() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_API_TOKEN
        and settings.R2_BUCKET
        and settings.R2_PUBLIC_URL
    )


def _object_url(key: str) -> str:
    return (
        f"https://api.cloudflare.com/client/v4/accounts/{settings.R2_ACCOUNT_ID}"
        f"/r2/buckets/{settings.R2_BUCKET}/objects/{key}"
    )


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.R2_API_TOKEN}"}


async def upload_avatar(user_id: str, image_bytes: bytes, content_type: str) -> str:
    """Upload avatar bytes to R2 and return the public URL.

    The object key is `avatars/{user_id}.{ext}` — one image per user,
    upload overwrites the previous file so we don't accumulate stale
    versions.
    """
    if not is_enabled():
        raise RuntimeError("R2 is not configured — check R2_* env vars.")

    ext = _extension_from_mime(content_type)
    key = f"avatars/{user_id}.{ext}"
    url = _object_url(key)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.put(
            url,
            headers={**_headers(), "Content-Type": content_type},
            content=image_bytes,
        )
        if resp.status_code >= 400:
            raise RuntimeError(
                f"R2 upload failed: HTTP {resp.status_code} — {resp.text[:200]}"
            )

    return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"


async def delete_avatar(user_id: str, previous_url: Optional[str]) -> None:
    """Delete the user's avatar object from R2 if present.

    Best-effort — if the object is already gone or R2 is unreachable
    we log and continue; the DB row is what actually controls what the
    UI displays. Never raises.

    IMPORTANT: this is meant for cleaning up a truly obsolete object.
    Do NOT call this after a fresh upload that overwrote the previous
    file at the same key — you'd delete the very file you just uploaded.
    Callers must ensure the previous_url points to a different key than
    the current one (e.g. because the extension changed jpg → png).
    """
    if not is_enabled() or not previous_url:
        return
    prefix = settings.R2_PUBLIC_URL.rstrip("/") + "/"
    if not previous_url.startswith(prefix):
        # Previous avatar was stored inline (base64) — nothing to remove.
        return
    key = previous_url[len(prefix):]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(_object_url(key), headers=_headers())
            if resp.status_code >= 400 and resp.status_code != 404:
                logger.warning(
                    "R2 delete for %s returned %d: %s",
                    key, resp.status_code, resp.text[:200],
                )
    except Exception as e:
        logger.warning("Failed to delete avatar %s: %s", key, e)


def _extension_from_mime(content_type: str) -> str:
    ct = (content_type or "").lower()
    if ct in ("image/jpeg", "image/jpg"):
        return "jpg"
    if ct == "image/png":
        return "png"
    if ct == "image/webp":
        return "webp"
    if ct == "image/gif":
        return "gif"
    return "jpg"  # sensible default; Pillow normalises everything to JPEG
