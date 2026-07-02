import logging
import urllib.parse
import httpx
import asyncio
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

FICBOOK_BASE = "https://ficbook.net"
# AppleWebKit/605.1 — exact UA from B1ays/ficbook-reader, avoids Cloudflare 403
HEADERS = {
    "User-Agent": "AppleWebKit/605.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Referer": "https://ficbook.net/",
}


class CountsRequest(BaseModel):
    query: str


def _card_to_dict(f, href_override: str = "") -> dict:
    href = (f.href or href_override).split("?")[0]
    ficbook_url = f"https://ficbook.net{href}" if href.startswith("/") else href
    return {
        "id": f.id, "title": f.title, "description": f.description,
        "author_name": f.author.name if f.author else "",
        "author_id": f.author.id if f.author else None,
        "fandoms": f.fandoms,
        "pairings": [{"characters": p.characters, "is_highlight": p.is_highlight} for p in f.pairings],
        "tags": [{"name": t.name, "is_adult": t.is_adult} for t in f.tags],
        "direction": f.status.direction.value, "rating": f.status.rating.value,
        "completion_status": f.status.status.value,
        "likes": f.status.likes, "trophies": f.status.trophies,
        "is_hot": f.status.is_hot, "cover_url": f.cover_url,
        "ficbook_url": ficbook_url,
        "words_count": 0, "chapters_count": 0, "comments_count": 0,
    }


@router.post("/counts")
async def get_search_counts(data: CountsRequest):
    """Get search result counts using ficbook's /get_multi_count JSON endpoint."""
    if not data.query.strip():
        return {"fanfics": 0, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}
    try:
        encoded = urllib.parse.urlencode({"query": data.query}).encode("utf-8")
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.post(
                f"{FICBOOK_BASE}/get_multi_count",
                content=encoded,
                headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                         "Accept": "application/json, text/javascript, */*; q=0.01",
                         "X-Requested-With": "XMLHttpRequest"},
            )
            resp.raise_for_status()
            result = resp.json()
            if result.get("result") and result.get("data"):
                d = result["data"]
                return {"fanfics": d.get("fanfics", 0), "requests": d.get("requests", 0),
                        "users": d.get("users", 0), "collections": d.get("collections", 0),
                        "fandoms": d.get("fandoms", 0)}
    except Exception as e:
        logger.warning(f"get_multi_count failed: {e}")
    return {"fanfics": 0, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}


@router.get("/")
async def search_fanfics(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search fanfics using find-fanfics-846555 path (correct obfuscated search slug)."""
    try:
        from ficbook_parser.client import FicbookClient
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Parser not available: {e}")

    try:
        async with FicbookClient() as client:
            fanfics, has_next = await client.search.search(q, page=page)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from ficbook.net: {e}")

    items = [_card_to_dict(f) for f in fanfics if f.id]
    return {"items": items, "total": len(items), "page": page, "page_size": page_size, "has_next": has_next}


@router.get("/suggest")
async def search_suggest(q: str = Query(..., min_length=1)):
    return {"suggestions": [], "query": q}
