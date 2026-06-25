import logging
import re
import urllib.parse
import httpx
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

FICBOOK_BASE = "https://ficbook.net"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Referer": "https://ficbook.net/",
}


class CountsRequest(BaseModel):
    query: str


@router.post("/counts")
async def get_search_counts(data: CountsRequest):
    """Get search result counts by fetching ficbook.net /find page directly."""
    if not data.query.strip():
        return {"fanfics": 0, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}

    try:
        from ficbook_parser.parsers.fanfic_list import FanficListParser
    except ImportError:
        return {"fanfics": 0, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}

    # ficbook /find returns 403 from datacenter IPs — use /fanfiction?q= instead
    target = f"{FICBOOK_BASE}/fanfiction?q={urllib.parse.quote(data.query)}"

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(target, headers=DEFAULT_HEADERS)
            resp.raise_for_status()
            raw = resp.content.decode("utf-8", errors="replace")
            try:
                import ftfy
                html = ftfy.fix_text(raw)
            except ImportError:
                html = raw

        fanfics, has_next = FanficListParser().parse(html)
        count = len([f for f in fanfics if f.id])
        fanfic_count: int | str = f"{count}+" if has_next else count

        return {"fanfics": fanfic_count, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}
    except Exception as e:
        logger.warning(f"search counts failed: {e}")

    return {"fanfics": 0, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}


@router.get("/")
async def search_fanfics(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search fanfics on ficbook.net via /find?q=... — direct request."""
    try:
        from ficbook_parser.parsers.fanfic_list import FanficListParser
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Parser not available: {e}")

    target = f"{FICBOOK_BASE}/fanfiction?q={urllib.parse.quote(q)}&p={page}"

    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(target, headers=DEFAULT_HEADERS)
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
    return {"suggestions": [], "query": q}
