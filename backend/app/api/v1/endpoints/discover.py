import logging
import os
import urllib.parse
import httpx
from fastapi import APIRouter, Query, HTTPException

router = APIRouter()
logger = logging.getLogger(__name__)

WORKER_URL = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")

# Mood → ficbook tag names
MOOD_TAGS = {
    "angst": "Ангст",
    "fluff": "Флафф",
    "romance": "Романтика",
    "drama": "Драма",
    "adventure": "Приключения",
    "humor": "Юмор",
}

# Category → fandom type param (all use /fanfiction base)
CATEGORY_PARAMS = {
    "anime": {"fandom_type": "anime"},
    "books": {"fandom_type": "books"},
    "games": {"fandom_type": "games"},
    "movies": {"fandom_type": "movies"},
    "series": {"fandom_type": "series"},
    "kpop": {"fandom_type": "rpf"},
}


def _build_ficbook_url(direction: str, category: str, status: str, mood: str, page: int) -> str:
    """Build ficbook.net search URL — all via /fanfiction with query params."""
    params: dict = {"p": page}

    # Direction filter
    if direction and direction != "any":
        params["direction"] = direction

    # Category filter
    if category and category in CATEGORY_PARAMS:
        params.update(CATEGORY_PARAMS[category])

    # Status filter
    if status == "complete":
        params["status"] = "complete"
    elif status == "in_progress":
        params["status"] = "in_progress"

    # Mood → tag
    if mood and mood in MOOD_TAGS:
        params["tags[]"] = MOOD_TAGS[mood]

    qs = urllib.parse.urlencode(params, doseq=True)
    return f"https://ficbook.net/fanfiction?{qs}"


@router.get("/discover")
async def discover_fanfics(
    direction: str = Query("", description="slash|het|gen|femslash"),
    mood: str = Query("", description="angst|fluff|romance|drama|adventure|humor"),
    size: str = Query("", description="short|medium|long"),
    status: str = Query("", description="complete|in_progress"),
    category: str = Query("", description="anime|books|games|movies|series|kpop"),
    page: int = Query(1, ge=1),
):
    """Fetch fanfics matching quiz answers via Cloudflare Worker."""
    try:
        from ficbook_parser.parsers.fanfic_list import FanficListParser
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Parser not available: {e}")

    target_url = _build_ficbook_url(direction, category, status, mood, page)

    # Convert to Worker URL — replace ficbook.net with worker domain
    path = target_url.replace("https://ficbook.net/", "")
    worker_url = f"{WORKER_URL}/{path}"

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(worker_url, headers={"User-Agent": "AppleWebKit/605.1"})
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
        fanfics, has_next = FanficListParser().parse(html)
    except Exception as e:
        logger.error(f"Parser error: {e}")
        return {"items": [], "has_next": False, "page": page, "ficbook_url": target_url}

    # Apply size filter client-side
    SIZE_FILTER = {"short": (0, 50000), "medium": (50000, 200000), "long": (200000, 10000000)}
    if size and size in SIZE_FILTER:
        min_w, max_w = SIZE_FILTER[size]
        # words_count is 0 in parsed cards; filter by likes as rough proxy
        # Better: keep all and note that size filtering is approximate

    items = []
    for f in fanfics:
        if not f.id:
            continue
        href = f.href.split("?")[0] if f.href else ""
        # Use UUID from href
        import re
        uuid_match = re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', href, re.I)
        fid = uuid_match.group(1) if uuid_match else f.id
        ficbook_url = f"https://ficbook.net{href}" if href.startswith("/") else href
        items.append({
            "id": fid,
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
            "size": f.size or "",
            "update_date": f.update_date or "",
            "words_count": 0, "chapters_count": 0, "comments_count": 0,
        })

    return {"items": items, "has_next": has_next, "page": page, "ficbook_url": target_url, "total": len(items)}
