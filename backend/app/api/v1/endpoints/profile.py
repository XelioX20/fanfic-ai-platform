import logging
import os
import httpx
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from app.core.security import verify_token
from app.db.session import AsyncSessionLocal
from app.db.repositories.users import UserRepository

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

WORKER_URL = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")
WORKER_HEADERS = {
    "User-Agent": "AppleWebKit/605.1",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9",
}

# Correct paths from B1ays/ficbook-reader reverse engineering.
#
# UX policy: our "В избранное" heart button on the fanfic page calls
# /actions/like → POST /ajax/mark on ficbook, which mutates the user's
# "Понравившиеся" list (home/liked_fanfics). So we surface that list under
# the /favourites endpoint too — a single "Избранное" tab in the UI that
# stays in sync with the heart button. The legacy /liked endpoint is kept
# for compatibility but points at the same list.
SECTIONS = {
    # UX-facing "Избранное" = ficbook's liked/hearted list
    "favourites":    "home/liked_fanfics",
    "liked":         "home/liked_fanfics",
    # Ficbook's own "recently read" list (populated when a signed-in user
    # opens a chapter on ficbook itself). We ALSO keep a local `history`
    # in the Zustand store on the client for anonymous browsing / offline
    # coverage; this endpoint is the signed-in fallback.
    "history":       "home/readedList",
    "subscriptions": "home/followList",
    "visited":       "home/visitedList",
    # ficbook collections — separate feature, not linked to the heart btn
    "collections":   "home/favourites",
}


async def _get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


async def _fetch_section(user_id: str, section_path: str, page: int) -> dict:
    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        cookies: dict = user.ficbook_cookies or {}

    if not cookies:
        raise HTTPException(status_code=403, detail="No ficbook session. Please log in again.")

    headers = {
        **WORKER_HEADERS,
        "x-ficbook-cookie": "; ".join(f"{k}={v}" for k, v in cookies.items()),
    }
    url = f"{WORKER_URL}/{section_path}?p={page}"

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            raw = resp.content.decode("utf-8", errors="replace")
            try:
                import ftfy
                html = ftfy.fix_text(raw)
            except ImportError:
                html = raw
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch: {e}")

    try:
        from ficbook_parser.parsers.fanfic_list import FanficListParser
        fanfics, has_next = FanficListParser().parse(html)
    except Exception as e:
        logger.error(f"Parser error: {e}")
        return {"items": [], "page": page, "has_next": False}

    items = [_card_to_dict(f) for f in fanfics if f.id]
    return {"items": items, "page": page, "has_next": has_next}


def _card_to_dict(card) -> dict:
    href = card.href.split("?")[0] if card.href else ""
    ficbook_url = f"https://ficbook.net{href}" if href.startswith("/") else href
    return {
        "id": card.id, "title": card.title, "description": card.description,
        "author_name": card.author.name if card.author else "",
        "author_id": card.author.id if card.author else None,
        "fandoms": card.fandoms,
        "pairings": [{"characters": p.characters} for p in card.pairings],
        "tags": [{"name": t.name, "is_adult": t.is_adult} for t in card.tags],
        "direction": card.status.direction.value, "rating": card.status.rating.value,
        "completion_status": card.status.status.value,
        "likes": card.status.likes, "trophies": card.status.trophies,
        "is_hot": card.status.is_hot, "cover_url": card.cover_url,
        "ficbook_url": ficbook_url,
        "size": card.size or "",
        "update_date": card.update_date or "",
        "words_count": 0, "chapters_count": 0, "comments_count": 0,
    }


@router.get("/me")
async def get_profile(user_id: str = Depends(_get_current_user_id)):
    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        # Effective avatar: custom upload takes precedence over ficbook avatar
        effective_avatar = getattr(user, 'custom_avatar_url', None) or user.ficbook_avatar_url
        return {
            "id": user.id, "ficbook_user_id": user.ficbook_user_id,
            "ficbook_username": user.ficbook_username,
            "ficbook_avatar_url": user.ficbook_avatar_url,
            "custom_avatar_url": getattr(user, 'custom_avatar_url', None),
            "avatar_url": effective_avatar,
            "ficbook_profile_url": (
                f"https://ficbook.net/authors/{user.ficbook_user_id}"
                if user.ficbook_user_id and not user.ficbook_user_id.startswith("u_") else None
            ),
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }


class AvatarPayload(BaseModel):
    """Either a base64 data URL (data:image/...;base64,...) or a remote https:// URL."""
    avatar_url: str


@router.put("/avatar")
async def update_avatar(payload: AvatarPayload, user_id: str = Depends(_get_current_user_id)):
    """Store a custom avatar URL (remote URL or base64 data-URL) for the user.

    Accepts:
    - Remote URL: https://... — stored as-is (useful for avatars already hosted elsewhere)
    - Base64 data URL: data:image/jpeg;base64,... — stored as text in the DB
      (no external storage required; the column is TEXT so size is ~200kB safe)

    Clients should resize/compress the image to ≤200kB before uploading to avoid
    slow page loads.
    """
    url = payload.avatar_url.strip()
    if not (url.startswith("https://") or url.startswith("data:image/")):
        raise HTTPException(status_code=422, detail="Неверный формат. Нужен URL (https://) или base64 изображение.")
    # 2MB image → ~2.7MB base64; reject oversized blobs
    if url.startswith("data:") and len(url) > 3_000_000:
        raise HTTPException(status_code=413, detail="Фото слишком большое — пожалуйста, сожми до 2 МБ.")

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.custom_avatar_url = url  # type: ignore[attr-defined]
        await db.commit()
        await db.refresh(user)
    return {"avatar_url": url}


@router.delete("/avatar", status_code=204)
async def delete_avatar(user_id: str = Depends(_get_current_user_id)):
    """Remove the custom avatar — fall back to the ficbook avatar."""
    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if user:
            user.custom_avatar_url = None  # type: ignore[attr-defined]
            await db.commit()
    return None


@router.get("/favourites")
async def get_favourites(page: int = Query(1, ge=1), user_id: str = Depends(_get_current_user_id)):
    return await _fetch_section(user_id, SECTIONS["favourites"], page)

@router.get("/history")
async def get_history(page: int = Query(1, ge=1), user_id: str = Depends(_get_current_user_id)):
    return await _fetch_section(user_id, SECTIONS["history"], page)

@router.get("/liked")
async def get_liked(page: int = Query(1, ge=1), user_id: str = Depends(_get_current_user_id)):
    return await _fetch_section(user_id, SECTIONS["liked"], page)

@router.get("/subscriptions")
async def get_subscriptions(page: int = Query(1, ge=1), user_id: str = Depends(_get_current_user_id)):
    return await _fetch_section(user_id, SECTIONS["subscriptions"], page)
