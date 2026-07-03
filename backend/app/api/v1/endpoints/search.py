import logging
import urllib.parse
import os
import httpx
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

WORKER_URL = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")
WORKER_HEADERS = {
    "User-Agent": "AppleWebKit/605.1",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9",
}


class CountsRequest(BaseModel):
    query: str


def _card_to_dict(f) -> dict:
    href = (f.href or "").split("?")[0]
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
        "size": f.size or "",
        "update_date": f.update_date or "",
    }


@router.post("/counts")
async def get_search_counts(data: CountsRequest):
    """Get search counts via /get_multi_count through Cloudflare Worker."""
    if not data.query.strip():
        return {"fanfics": 0, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}
    try:
        encoded = urllib.parse.urlencode({"query": data.query}).encode("utf-8")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{WORKER_URL}/get_multi_count",
                content=encoded,
                headers={
                    **WORKER_HEADERS,
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Accept": "application/json, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest",
                },
            )
            resp.raise_for_status()
            result = resp.json()
            if result.get("result") and result.get("data"):
                d = result["data"]
                return {
                    "fanfics": d.get("fanfics", 0), "requests": d.get("requests", 0),
                    "users": d.get("users", 0), "collections": d.get("collections", 0),
                    "fandoms": d.get("fandoms", 0),
                }
    except Exception as e:
        logger.warning(f"get_multi_count via worker failed: {e}")
    return {"fanfics": 0, "requests": 0, "users": 0, "collections": 0, "fandoms": 0}


@router.get("/")
async def search_fanfics(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search fanfics through Cloudflare Worker."""
    try:
        from ficbook_parser.parsers.fanfic_list import FanficListParser
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Parser not available: {e}")

    search_path = f"find-fanfics-846555?title={urllib.parse.quote(q)}&p={page}"
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(f"{WORKER_URL}/{search_path}", headers=WORKER_HEADERS)
            resp.raise_for_status()
            raw = resp.content.decode("utf-8", errors="replace")
            try:
                import ftfy
                html = ftfy.fix_text(raw)
            except ImportError:
                html = raw
        fanfics, has_next = FanficListParser().parse(html)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Search failed: {e}")

    items = [_card_to_dict(f) for f in fanfics if f.id]
    return {"items": items, "total": len(items), "page": page, "page_size": page_size, "has_next": has_next}


@router.get("/list")
async def list_fanfics(
    path: str = Query("fanfiction", description="ficbook path, e.g. fanfiction, fanfiction?direction=slash"),
    page: int = Query(1, ge=1),
):
    """
    List fanfics from any ficbook section via the Worker.
    Uses the full BeautifulSoup parser so cards include author, fandoms, pairings, tags, size, description.
    """
    try:
        from ficbook_parser.parsers.fanfic_list import FanficListParser
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Parser not available: {e}")

    # Build path with page param, preserving any existing query string
    sep = "&" if "?" in path else "?"
    target_path = f"{path}{sep}p={page}"

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(f"{WORKER_URL}/{target_path}", headers=WORKER_HEADERS)
            resp.raise_for_status()
            raw = resp.content.decode("utf-8", errors="replace")
            try:
                import ftfy
                html = ftfy.fix_text(raw)
            except ImportError:
                html = raw
        fanfics, has_next = FanficListParser().parse(html)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"List fetch failed: {e}")

    items = [_card_to_dict(f) for f in fanfics if f.id]
    return {"items": items, "page": page, "has_next": has_next}


@router.get("/suggest")
async def search_suggest(q: str = Query(..., min_length=1)):
    return {"suggestions": [], "query": q}
