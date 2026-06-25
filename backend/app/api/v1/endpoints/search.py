import logging
import urllib.parse
import httpx
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

FICBOOK_BASE = "https://ficbook.net"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": "https://ficbook.net/",
    "X-Requested-With": "XMLHttpRequest",
}


class CountsRequest(BaseModel):
    query: str


@router.post("/counts")
async def get_search_counts(data: CountsRequest):
    """Get search result counts per category from ficbook.net."""
    if not data.query.strip():
        return {"fanfics": 0, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}

    import os
    encoded_body = urllib.parse.urlencode({"query": data.query}).encode("utf-8")

    # Get a ficbook session to bypass datacenter IP blocking
    # Reuse stored session cookies from any logged-in user, or get anonymous session
    session_cookie = await _get_ficbook_session()

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            headers = {
                **DEFAULT_HEADERS,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json, text/javascript, */*; q=0.01",
            }
            if session_cookie:
                headers["Cookie"] = session_cookie

            resp = await client.post(
                f"{FICBOOK_BASE}/get_multi_count",
                content=encoded_body,
                headers=headers,
            )
            resp.raise_for_status()
            result = resp.json()
            if result.get("result") and result.get("data"):
                d = result["data"]
                return {
                    "fanfics": d.get("fanfics", 0),
                    "requests": d.get("requests", 0),
                    "users": d.get("users", 0),
                    "collections": d.get("collections", 0),
                    "fandoms": d.get("fandoms", 0),
                }
    except Exception as e:
        logger.warning(f"get_multi_count failed: {e}")

    return {"fanfics": 0, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}


@router.get("/debug-counts")
async def debug_counts(query: str = "harry potter"):
    """Debug: test get_multi_count with session cookie from DB."""
    session_cookie = await _get_ficbook_session()
    encoded_body = urllib.parse.urlencode({"query": query}).encode("utf-8")
    headers = {
        **DEFAULT_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
    }
    if session_cookie:
        headers["Cookie"] = session_cookie

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.post(
                f"{FICBOOK_BASE}/get_multi_count",
                content=encoded_body,
                headers=headers,
            )
            return {
                "status": resp.status_code,
                "session_cookie": session_cookie[:50] + "..." if session_cookie else None,
                "response": resp.text[:200],
            }
    except Exception as e:
        return {"error": str(e), "session_cookie": session_cookie[:50] if session_cookie else None}


_ficbook_session_cache: dict = {"cookie": None, "expires": 0}


async def _get_ficbook_session() -> str | None:
    """
    Get a ficbook.net session cookie.
    First tries to reuse any stored user cookie from DB.
    Falls back to getting an anonymous session from ficbook.net.
    """
    import time
    global _ficbook_session_cache

    # Return cached if still valid (30 min)
    if _ficbook_session_cache["cookie"] and time.time() < _ficbook_session_cache["expires"]:
        return _ficbook_session_cache["cookie"]

    # Try to get any stored ficbook session from DB
    try:
        from app.db.session import AsyncSessionLocal
        from sqlalchemy import select, text
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text("SELECT ficbook_cookies FROM platform_users WHERE ficbook_cookies IS NOT NULL LIMIT 1")
            )
            row = result.fetchone()
            if row and row[0]:
                import json
                cookies = row[0] if isinstance(row[0], dict) else json.loads(row[0])
                if cookies:
                    cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
                    _ficbook_session_cache = {"cookie": cookie_str, "expires": time.time() + 1800}
                    return cookie_str
    except Exception as e:
        logger.debug(f"Could not get session from DB: {e}")

    # Get anonymous session from ficbook.net
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                f"{FICBOOK_BASE}/",
                headers={"User-Agent": DEFAULT_HEADERS["User-Agent"]},
            )
            cookies = dict(resp.cookies)
            if cookies:
                cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
                _ficbook_session_cache = {"cookie": cookie_str, "expires": time.time() + 1800}
                return cookie_str
    except Exception as e:
        logger.debug(f"Could not get anonymous session: {e}")

    return None


@router.get("/")
async def search_fanfics(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search fanfics on ficbook.net via /find?q=..."""
    try:
        from ficbook_parser.proxy import proxy_url
        from ficbook_parser.parsers.fanfic_list import FanficListParser
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Parser not available: {e}")

    target = f"{FICBOOK_BASE}/find?q={urllib.parse.quote(q)}&p={page}"
    fetch_url = proxy_url(target) or target

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(fetch_url, headers=headers)
            resp.raise_for_status()
            raw = resp.content.decode("utf-8", errors="replace")
            try:
                import ftfy
                html = ftfy.fix_text(raw)
            except ImportError:
                html = raw
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from ficbook.net: {e}")

    try:
        fanfics, has_next = FanficListParser().parse(html)
    except Exception as e:
        logger.error(f"Search parser error: {e}")
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "has_next": False}

    items = []
    for f in fanfics:
        if not f.id:
            continue
        href = f.href.split("?")[0] if f.href else ""
        ficbook_url = f"https://ficbook.net{href}" if href.startswith("/") else href
        items.append({
            "id": f.id,
            "title": f.title,
            "description": f.description,
            "author_name": f.author.name if f.author else "",
            "author_id": f.author.id if f.author else None,
            "fandoms": f.fandoms,
            "pairings": [{"characters": p.characters, "is_highlight": p.is_highlight} for p in f.pairings],
            "tags": [{"name": t.name, "is_adult": t.is_adult} for t in f.tags],
            "direction": f.status.direction.value,
            "rating": f.status.rating.value,
            "completion_status": f.status.status.value,
            "likes": f.status.likes,
            "trophies": f.status.trophies,
            "is_hot": f.status.is_hot,
            "cover_url": f.cover_url,
            "ficbook_url": ficbook_url,
            "words_count": 0,
            "chapters_count": 0,
            "comments_count": 0,
        })

    return {
        "items": items,
        "total": len(items),
        "page": page,
        "page_size": page_size,
        "has_next": has_next,
    }


@router.get("/suggest")
async def search_suggest(q: str = Query(..., min_length=1)):
    """Basic suggestions — return empty for now, ficbook doesn't have a public suggest API."""
    return {"suggestions": [], "query": q}
