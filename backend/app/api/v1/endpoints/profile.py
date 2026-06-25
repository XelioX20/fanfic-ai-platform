import os
import logging
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from app.core.security import verify_token
from app.db.session import AsyncSessionLocal
from app.db.repositories.users import UserRepository

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY", "")


async def _get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


async def _make_ficbook_client(user_id: str):
    """Create FicbookClient with stored user cookies, or re-auth if cookies missing."""
    try:
        from ficbook_parser.client import FicbookClient
    except ImportError:
        raise HTTPException(status_code=503, detail="ficbook_parser not available")

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        cookies = user.ficbook_cookies or {}

    # Use stored cookies — no ScraperAPI needed for authenticated requests
    return FicbookClient(cookies=cookies)


@router.get("/me")
async def get_profile(user_id: str = Depends(_get_current_user_id)):
    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user.id,
            "ficbook_user_id": user.ficbook_user_id,
            "ficbook_username": user.ficbook_username,
            "ficbook_avatar_url": user.ficbook_avatar_url,
            "ficbook_profile_url": f"https://ficbook.net/authors/{user.ficbook_user_id}" if user.ficbook_user_id else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
        }


@router.get("/favourites")
async def get_favourites(
    page: int = Query(1, ge=1),
    user_id: str = Depends(_get_current_user_id),
):
    """Get user's favourites from ficbook.net."""
    try:
        from ficbook_parser.models.sections import UserSections
        client = await _make_ficbook_client(user_id)
        async with client:
            fanfics, has_next = await client.fanfics_list.get(
                UserSections.FAVOURITES, page=page
            )
    except Exception as e:
        logger.error(f"Failed to fetch favourites for {user_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch from ficbook.net: {e}")

    return {
        "items": [_card_to_dict(f) for f in fanfics],
        "page": page,
        "has_next": has_next,
        "total": len(fanfics),
    }


@router.get("/history")
async def get_history(
    page: int = Query(1, ge=1),
    user_id: str = Depends(_get_current_user_id),
):
    """Get user's reading history from ficbook.net."""
    try:
        from ficbook_parser.models.sections import UserSections
        client = await _make_ficbook_client(user_id)
        async with client:
            fanfics, has_next = await client.fanfics_list.get(
                UserSections.READ, page=page
            )
    except Exception as e:
        logger.error(f"Failed to fetch history for {user_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch from ficbook.net: {e}")

    return {
        "items": [_card_to_dict(f) for f in fanfics],
        "page": page,
        "has_next": has_next,
    }


@router.get("/liked")
async def get_liked(
    page: int = Query(1, ge=1),
    user_id: str = Depends(_get_current_user_id),
):
    """Get user's liked fanfics from ficbook.net."""
    try:
        from ficbook_parser.models.sections import UserSections
        client = await _make_ficbook_client(user_id)
        async with client:
            fanfics, has_next = await client.fanfics_list.get(
                UserSections.LIKED, page=page
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from ficbook.net: {e}")

    return {"items": [_card_to_dict(f) for f in fanfics], "page": page, "has_next": has_next}


@router.get("/subscriptions")
async def get_subscriptions(
    page: int = Query(1, ge=1),
    user_id: str = Depends(_get_current_user_id),
):
    """Get user's author subscriptions from ficbook.net."""
    try:
        from ficbook_parser.models.sections import UserSections
        client = await _make_ficbook_client(user_id)
        async with client:
            fanfics, has_next = await client.fanfics_list.get(
                UserSections.FOLLOW, page=page
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from ficbook.net: {e}")

    return {"items": [_card_to_dict(f) for f in fanfics], "page": page, "has_next": has_next}


def _card_to_dict(card) -> dict:
    return {
        "id": card.id,
        "title": card.title,
        "description": card.description,
        "author_name": card.author.name if card.author else "",
        "author_id": card.author.id if card.author else None,
        "fandoms": card.fandoms,
        "pairings": [{"characters": p.characters} for p in card.pairings],
        "tags": [{"name": t.name, "is_adult": t.is_adult} for t in card.tags],
        "direction": card.status.direction.value,
        "rating": card.status.rating.value,
        "completion_status": card.status.status.value,
        "likes": card.status.likes,
        "trophies": card.status.trophies,
        "is_hot": card.status.is_hot,
        "cover_url": card.cover_url,
        "ficbook_url": f"https://ficbook.net{card.href}",
        "words_count": 0,
        "chapters_count": 0,
        "comments_count": 0,
    }
