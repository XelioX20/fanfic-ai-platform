import logging
import httpx
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from app.core.security import verify_token
from app.db.session import AsyncSessionLocal
from app.db.repositories.users import UserRepository

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

FICBOOK_BASE = "https://ficbook.net"
HEADERS = {
    "User-Agent": "AppleWebKit/605.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Referer": "https://ficbook.net/",
}

# Correct paths from B1ays/ficbook-reader source
SECTIONS = {
    "favourites":    "home/favourites",
    "history":       "home/readedList",    # Was home/bookmarks — wrong
    "liked":         "home/liked_fanfics", # Was home/bookmarks — wrong
    "subscriptions": "home/followList",    # Was home/subscriptions — wrong
    "visited":       "home/visitedList",
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

    target = f"{FICBOOK_BASE}/{section_path}?p={page}"
    headers = {**HEADERS, "Cookie": "; ".join(f"{k}={v}" for k, v in cookies.items())}

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(target, headers=headers)
            resp.raise_for_status()
            raw = resp.content.decode("utf-8", errors="replace")
            try:
                import ftfy
                html = ftfy.fix_text(raw)
            except ImportError:
                html = raw
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from ficbook.net: {e}")

    # Check redirect to login (session expired)
    if "_csrf_token" in html and "login" in html.lower()[:2000] and "readedList" not in html:
        raise HTTPException(status_code=403, detail="Ficbook session expired. Please log in again.")

    try:
        from ficbook_parser.parsers.fanfic_list import FanficListParser
        fanfics, has_next = FanficListParser().parse(html)
    except Exception as e:
        logger.error(f"Parser error for {section_path}: {e}")
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
        "words_count": 0, "chapters_count": 0, "comments_count": 0,
    }


@router.get("/me")
async def get_profile(user_id: str = Depends(_get_current_user_id)):
    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user.id, "ficbook_user_id": user.ficbook_user_id,
            "ficbook_username": user.ficbook_username, "ficbook_avatar_url": user.ficbook_avatar_url,
            "ficbook_profile_url": (
                f"https://ficbook.net/authors/{user.ficbook_user_id}"
                if user.ficbook_user_id and not user.ficbook_user_id.startswith("u_") else None
            ),
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }


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
