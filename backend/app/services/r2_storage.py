"""Cloudflare R2 storage adapter for user avatars.

R2 is S3-compatible, so we drive it with aioboto3 pointed at the R2
endpoint. Objects are addressed as `avatars/{user_id}.{ext}` inside the
bucket; the public URL served to the browser is
`{R2_PUBLIC_URL}/avatars/{user_id}.{ext}`.

The module is optional — if R2_BUCKET is empty (development or no R2
configured), `is_enabled()` returns False and callers fall back to
storing the base64 data-URL directly in the users.custom_avatar_url
TEXT column.
"""
from __future__ import annotations

import io
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# lazy import — aioboto3 is only needed when R2 is configured
_session = None


def is_enabled() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET
        and settings.R2_PUBLIC_URL
    )


def _endpoint_url() -> str:
    return f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"


def _get_session():
    global _session
    if _session is None:
        import aioboto3
        _session = aioboto3.Session()
    return _session


async def upload_avatar(user_id: str, image_bytes: bytes, content_type: str) -> str:
    """Upload avatar bytes to R2 and return the public URL.

    The object key is `avatars/{user_id}.{ext}` — one image per user,
    upload overwrites the previous file so we don't accumulate stale
    versions. A cache-busting `?v={timestamp}` is NOT added here because
    the DB row change already invalidates the frontend cache when the
    user re-fetches /profile/me.
    """
    if not is_enabled():
        raise RuntimeError("R2 is not configured — check R2_* env vars.")

    ext = _extension_from_mime(content_type)
    key = f"avatars/{user_id}.{ext}"
    session = _get_session()

    async with session.client(
        "s3",
        endpoint_url=_endpoint_url(),
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    ) as client:
        await client.put_object(
            Bucket=settings.R2_BUCKET,
            Key=key,
            Body=io.BytesIO(image_bytes),
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )

    return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"


async def delete_avatar(user_id: str, previous_url: Optional[str]) -> None:
    """Delete the user's avatar object from R2 if present.

    Best-effort — if the object is already gone or R2 is unreachable
    we log and continue; the DB row is what actually controls what the
    UI displays.
    """
    if not is_enabled() or not previous_url:
        return
    if not previous_url.startswith(settings.R2_PUBLIC_URL.rstrip("/")):
        # Previous avatar was stored inline (base64) — nothing to remove.
        return
    key = previous_url[len(settings.R2_PUBLIC_URL.rstrip("/")) + 1 :]
    session = _get_session()
    try:
        async with session.client(
            "s3",
            endpoint_url=_endpoint_url(),
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        ) as client:
            await client.delete_object(Bucket=settings.R2_BUCKET, Key=key)
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
    return "jpg"  # sensible default; Pillow will have normalised to JPEG
