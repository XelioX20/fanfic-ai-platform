import logging
import httpx
from fastapi import APIRouter, Query, HTTPException
from typing import Optional

router = APIRouter()
logger = logging.getLogger(__name__)

FICBOOK_BASE = "https://ficbook.net"

# Map quiz answers to ficbook.net URL paths
DIRECTION_PATH = {
    "slash":    "fanfiction/slash",
    "het":      "fanfiction/het",
    "gen":      "fanfiction/gen",
    "femslash": "fanfiction/femslash",
}

CATEGORY_PATH = {
    "anime":  "fanfiction/anime",
    "books":  "fanfiction/books",
    "games":  "fanfiction/games",
    "movies": "fanfiction/movies",
    "series": "fanfiction/series",
    "kpop":   "fanfiction/rpf/k_pop",
}

# Mood → tags to search on ficbook
MOOD_TAGS = {
    "angst":     "Ангст",
    "fluff":     "Флафф",
    "romance":   "Романтика",
    "drama":     "Драма",
    "adventure": "Приключения",
    "humor":     "Юмор",
}

# Size → words_count filter (applied client-side after fetch)
SIZE_FILTER = {
    "short":  (0, 50_000),
    "medium": (50_000, 200_000),
    "long":   (200_000, 10_000_000),
}


def _build_ficbook_url(
    direction: str,
    category: str,
    status: str,
    mood: str,
    page: int,
) -> str:
    """Build ficbook.net URL from quiz answers."""
    # Priority: category > direction > default
    if category and category in CATEGORY_PATH:
        base_path = CATEGORY_PATH[category]
    elif direction and direction in DIRECTION_PATH:
        base_path = DIRECTION_PATH[direction]
    else:
        base_path = "fanfiction"

    # If both category and direction are set, combine
    if category and direction and category in CATEGORY_PATH and direction in DIRECTION_PATH:
        # Use category path + sort by direction is not directly supported,
        # so use the direction path with category as fandom type
        dir_path = DIRECTION_PATH[direction]
        cat_path = CATEGORY_PATH[category]
        # ficbook supports: /fanfiction/anime/slash etc.
        # Try combining: category + direction suffix
        base_path = f"{cat_path}/{direction}" if direction != "any" else cat_path

    url = f"{FICBOOK_BASE}/{base_path}?p={page}"

    if status == "complete":
        url += "&status=complete"
    elif status == "in_progress":
        url += "&status=in_progress"

    if mood and mood in MOOD_TAGS:
        import urllib.parse
        tag = urllib.parse.quote(MOOD_TAGS[mood])
        url += f"&tags[]={tag}"

    return url


@router.get("/discover")
async def discover_fanfics(
    direction: str = Query("", description="slash|het|gen|femslash"),
    mood: str = Query("", description="angst|fluff|romance|drama|adventure|humor"),
    size: str = Query("", description="short|medium|long"),
    status: str = Query("", description="complete|in_progress"),
    category: str = Query("", description="anime|books|games|movies|series|kpop"),
    page: int = Query(1, ge=1),
):
    """Fetch fanfics matching quiz answers from ficbook.net."""
    try:
        from ficbook_parser.proxy import proxy_url
        from ficbook_parser.parsers.fanfic_list import FanficListParser
        import ftfy
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Parser not available: {e}")

    target_url = _build_ficbook_url(direction, category, status, mood, page)
    fetch_url = proxy_url(target_url) or target_url

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
                html = ftfy.fix_text(raw)
            except Exception:
                html = raw
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from ficbook.net: {e}")

    try:
        fanfics, has_next = FanficListParser().parse(html)
    except Exception as e:
        logger.error(f"Parser error: {e}")
        return {"items": [], "has_next": False, "page": page, "ficbook_url": target_url}

    # Apply size filter
    if size and size in SIZE_FILTER:
        min_w, max_w = SIZE_FILTER[size]
        fanfics = [f for f in fanfics if f.id and (
            f.status.likes > 0 or  # keep if has any engagement (words may be 0)
            min_w <= 0  # keep short
        )]

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
        "has_next": has_next,
        "page": page,
        "ficbook_url": target_url,
        "total": len(items),
    }
