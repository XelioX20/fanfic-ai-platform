"""
Ficbook.net user action endpoints — like, mark read, follow fanfic.
All use ficbook's internal AJAX JSON endpoints confirmed to work without proxy.
"""
import os
import httpx
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from app.core.security import verify_token
from app.db.session import AsyncSessionLocal
from app.db.repositories.users import UserRepository

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

FICBOOK_BASE = "https://ficbook.net"
UA = "AppleWebKit/605.1"


async def _get_user_cookies(user_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user or not user.ficbook_cookies:
            raise HTTPException(status_code=403, detail="Not logged in to ficbook. Please log in again.")
        return user.ficbook_cookies


async def _get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


async def _ficbook_post(path: str, data: dict, cookies: dict) -> dict:
    """POST to ficbook.net AJAX endpoint with user session cookies."""
    cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.post(
            f"{FICBOOK_BASE}/{path}",
            data=data,
            headers={
                "User-Agent": UA,
                "Cookie": cookie_str,
                "X-Requested-With": "XMLHttpRequest",
                "Referer": f"{FICBOOK_BASE}/",
            },
        )
        resp.raise_for_status()
        return resp.json()


class FanficActionRequest(BaseModel):
    fanfic_id: str


@router.post("/like")
async def like_fanfic(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Like a fanfic (POST /ajax/mark with action=add)."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("ajax/mark", {"fanfic_id": data.fanfic_id, "action": "add"}, cookies)
        return {"success": result.get("result", False), "action": "liked"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/unlike")
async def unlike_fanfic(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Unlike a fanfic (POST /ajax/mark with action=remove)."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("ajax/mark", {"fanfic_id": data.fanfic_id, "action": "remove"}, cookies)
        return {"success": result.get("result", False), "action": "unliked"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/mark-read")
async def mark_read(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Mark fanfic as read (POST /fanfic_read/read)."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("fanfic_read/read", {"fanfic_id": data.fanfic_id}, cookies)
        return {"success": result.get("result", False), "action": "marked_read"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/mark-unread")
async def mark_unread(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Mark fanfic as unread."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("fanfic_read/unread", {"fanfic_id": data.fanfic_id}, cookies)
        return {"success": result.get("result", False), "action": "marked_unread"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/follow")
async def follow_fanfic(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Follow/subscribe to fanfic updates."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("fanfic_follow/follow", {"fanfic_id": data.fanfic_id}, cookies)
        return {"success": result.get("result", False), "action": "followed"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/unfollow")
async def unfollow_fanfic(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Unfollow fanfic."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("fanfic_follow/unfollow", {"fanfic_id": data.fanfic_id}, cookies)
        return {"success": result.get("result", False), "action": "unfollowed"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/state/{fanfic_id}")
async def get_fanfic_state(
    fanfic_id: str,
    user_id: str = Depends(_get_current_user_id),
):
    """Get current like/read/follow state for a fanfic (POST /ajax/fanfic_actions_state)."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("ajax/fanfic_actions_state", {"fanfic_id": fanfic_id}, cookies)
        data = result.get("data", {})
        return {
            "is_liked": data.get("isLiked", False),
            "is_read": data.get("isFullyRead", False),
            "is_followed": data.get("isFollowed", False),
        }
    except Exception as e:
        return {"is_liked": False, "is_read": False, "is_followed": False}
