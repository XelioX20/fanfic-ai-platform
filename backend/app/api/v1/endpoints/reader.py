import logging
import os
import re
import time
import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

WORKER_URL = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")


# ── In-memory response cache ───────────────────────────────────────────
#
# Fanfic metadata and chapter content are shared-cacheable: same fanfic_id
# → identical payload for all users, no personalization, slow-changing.
# Chapters are effectively immutable once published.
#
# Redis isn't configured on the free Render tier, so we use a plain dict.
# It lives inside one Python process (single dyno) — no cross-instance
# consistency, but that's fine: a cold-start clears the cache and warms
# up as users hit it. Compared to the previous "scrape every request"
# behavior it turns 1-3s into ~20ms for repeat views inside one Render
# uptime window (typically ~15 min of activity).
_TTL_FULL_S = 900        # 15 min — fanfic metadata changes rarely
_TTL_CHAPTER_S = 86400   # 24 h  — chapters are immutable once published
_CACHE_MAX_ENTRIES = 500  # hard cap so a scraping bot can't OOM the dyno

_cache: dict[str, tuple[float, dict]] = {}


def _cache_get(key: str) -> Optional[dict]:
    entry = _cache.get(key)
    if not entry:
        return None
    expires, value = entry
    if time.monotonic() > expires:
        _cache.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: dict, ttl_s: int) -> None:
    # Simple bound: on overflow drop 25% of oldest entries.
    if len(_cache) >= _CACHE_MAX_ENTRIES:
        for k in list(_cache.keys())[: _CACHE_MAX_ENTRIES // 4]:
            _cache.pop(k, None)
    _cache[key] = (time.monotonic() + ttl_s, value)


async def _fetch_html(url: str, http: httpx.AsyncClient) -> str:
    """Fetch ficbook.net HTML via Cloudflare Worker (bypasses datacenter IP blocking).

    Uses the process-wide AsyncClient (keep-alive + reused TLS) instead of
    creating a fresh client per call — saves ~150-400ms of handshake per
    cache-miss.
    """
    ficbook_path = re.sub(r'^https?://ficbook\.net/', '', url)
    worker_url = f"{WORKER_URL}/{ficbook_path}"

    resp = await http.get(worker_url)
    resp.raise_for_status()
    raw = resp.content.decode("utf-8", errors="replace")
    try:
        import ftfy
        return ftfy.fix_text(raw)
    except ImportError:
        return raw


class ChapterInfo(BaseModel):
    id: str
    title: str
    date: str
    words_count: int


class FanficFullResponse(BaseModel):
    id: str
    title: str
    description: str
    dedication: str
    author_notes: str
    cover_url: Optional[str]
    direction: str
    rating: str
    completion_status: str
    likes: int
    trophies: int
    comments_count: int
    is_hot: bool
    authors: list[dict]
    fandoms: list[str]
    pairings: list[dict]
    tags: list[dict]
    chapters: list[ChapterInfo]
    is_single_chapter: bool
    single_chapter_html: Optional[str]


class ChapterResponse(BaseModel):
    id: str
    fanfic_id: str
    title: str
    date: str
    words_count: int
    html: str
    prev_chapter_id: Optional[str]
    next_chapter_id: Optional[str]


def _has_cookie(request: Request) -> bool:
    """True if the request looks personalized (Ficbook session cookie present)
    and should NOT hit the shared cache — protects adult/logged-in content
    from leaking through the cache."""
    return bool(request.headers.get("x-ficbook-cookie"))


@router.get("/fanfics/{fanfic_id}/full", response_model=FanficFullResponse)
async def get_fanfic_full(fanfic_id: str, request: Request, response: Response):
    """Fetch full fanfic metadata + chapter list via Cloudflare Worker.

    Cached in-memory for 15 min per (fanfic_id) and downstream via
    Cache-Control so the browser + Vercel/CDN can serve repeat views
    without hitting Render at all.
    """
    is_personalized = _has_cookie(request)
    cache_key = f"full:{fanfic_id}"

    # Public (cookie-less) requests share cache.
    if not is_personalized:
        cached = _cache_get(cache_key)
        if cached is not None:
            response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=3600"
            response.headers["X-Cache"] = "HIT"
            return cached
        response.headers["X-Cache"] = "MISS"
    else:
        response.headers["Cache-Control"] = "private, no-store"

    http: httpx.AsyncClient = request.app.state.http
    try:
        html = await _fetch_html(f"https://ficbook.net/readfic/{fanfic_id}", http)
        from ficbook_parser.parsers.fanfic_page import FanficPageParser
        page = FanficPageParser().parse(html, fanfic_id)
    except Exception as e:
        logger.error(f"Failed to fetch fanfic {fanfic_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch from ficbook.net: {e}")

    chapters = []
    is_single = False
    single_html = None

    if page.chapters is None:
        is_single = True
    elif hasattr(page.chapters, "html_content"):
        is_single = True
        single_html = page.chapters.html_content
    elif hasattr(page.chapters, "chapters"):
        for ch in page.chapters.chapters:
            chapters.append(ChapterInfo(
                id=ch.id,
                title=ch.title,
                date=ch.date,
                words_count=ch.words_count,
            ))

    result = FanficFullResponse(
        id=fanfic_id,
        title=page.name,
        description=page.description or "",
        dedication=page.dedication or "",
        author_notes=page.author_notes or "",
        cover_url=page.cover_url,
        direction=page.direction.value,
        rating=page.rating.value,
        completion_status=page.status.status.value,
        likes=page.likes,
        trophies=page.trophies,
        comments_count=page.comments_count,
        is_hot=page.status.is_hot,
        authors=[
            {
                "name": a.user.name,
                "id": a.user.id,
                "href": a.user.href,
                "role": a.role,
                "avatar_url": a.user.avatar_url,
            }
            for a in page.authors
        ],
        fandoms=page.fandoms,
        pairings=[{"characters": p.characters, "is_highlight": p.is_highlight} for p in page.pairings],
        tags=[{"name": t.name, "is_adult": t.is_adult} for t in page.tags],
        chapters=chapters,
        is_single_chapter=is_single,
        single_chapter_html=single_html,
    )

    if not is_personalized:
        # Cache the pydantic-serializable dict — smaller memory footprint
        # than the model instance and identical output on next request.
        _cache_set(cache_key, result.model_dump(), _TTL_FULL_S)
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=3600"

    return result


@router.get("/fanfics/{fanfic_id}/chapter/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(
    fanfic_id: str,
    chapter_id: str,
    request: Request,
    response: Response,
    all_chapters: str = "",
):
    """Fetch chapter content via Cloudflare Worker.

    Chapter content is effectively immutable — cached for 24h in-memory
    and marked immutable for the browser.
    """
    is_personalized = _has_cookie(request)
    clean_id = chapter_id.split("#")[0].strip("/")
    cache_key = f"chapter:{fanfic_id}:{clean_id}"

    if not is_personalized:
        cached = _cache_get(cache_key)
        if cached is not None:
            # prev/next depend on the client-side all_chapters list which
            # is stable per fanfic, but we still recompute here per request
            # so a reader that added more chapters later gets the fresh nav.
            cached = dict(cached)
            cached["prev_chapter_id"], cached["next_chapter_id"] = _neighbours(all_chapters, chapter_id)
            response.headers["Cache-Control"] = "public, max-age=86400, immutable"
            response.headers["X-Cache"] = "HIT"
            return cached
        response.headers["X-Cache"] = "MISS"
    else:
        response.headers["Cache-Control"] = "private, no-store"

    http: httpx.AsyncClient = request.app.state.http
    try:
        html = await _fetch_html(f"https://ficbook.net/readfic/{fanfic_id}/{clean_id}", http)
        from ficbook_parser.parsers.chapter import ChapterParser
        chapter = ChapterParser().parse(html, clean_id)
    except Exception as e:
        logger.error(f"Failed to fetch chapter {chapter_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch chapter: {e}")

    prev_id, next_id = _neighbours(all_chapters, chapter_id)

    result = ChapterResponse(
        id=chapter.id,
        fanfic_id=fanfic_id,
        title=chapter.title,
        date=chapter.date,
        words_count=chapter.words_count,
        html=chapter.text or "",
        prev_chapter_id=prev_id,
        next_chapter_id=next_id,
    )

    if not is_personalized:
        # Cache the payload WITHOUT prev/next (they depend on all_chapters
        # query param). Neighbors are re-computed cheaply on every request.
        payload = result.model_dump()
        payload["prev_chapter_id"] = None
        payload["next_chapter_id"] = None
        _cache_set(cache_key, payload, _TTL_CHAPTER_S)
        response.headers["Cache-Control"] = "public, max-age=86400, immutable"

    return result


def _neighbours(all_chapters: str, chapter_id: str) -> tuple[Optional[str], Optional[str]]:
    if not all_chapters:
        return None, None
    ids = all_chapters.split(",")
    try:
        idx = ids.index(chapter_id)
    except ValueError:
        return None, None
    prev = ids[idx - 1] if idx > 0 else None
    nxt = ids[idx + 1] if idx < len(ids) - 1 else None
    return prev, nxt


@router.get("/fanfics/{fanfic_id}/debug-scripts")
async def debug_scripts(fanfic_id: str, request: Request):
    """Show script tag contents from fanfic page to find embedded chapter data."""
    http: httpx.AsyncClient = request.app.state.http
    target = f"https://ficbook.net/readfic/{fanfic_id}"
    html = await _fetch_html(target, http)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    scripts = []
    for s in soup.find_all("script"):
        text = s.string or ""
        if any(kw in text for kw in ["parts", "chapters", "chapter", "part_id", "readfic"]):
            scripts.append(text[:500])
    return {"script_count": len(scripts), "scripts": scripts[:5]}


@router.get("/fanfics/{fanfic_id}/debug-html")
async def debug_fanfic_html(fanfic_id: str, request: Request):
    """Return raw HTML snippet from ficbook.net fanfic page for debugging selectors."""
    http: httpx.AsyncClient = request.app.state.http
    target = f"https://ficbook.net/readfic/{fanfic_id}"
    html = await _fetch_html(target, http)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")

    title_el = soup.select_one("h1[itemprop=name], h1.heading, h1.fanfic-main-info, h1")
    title_text = title_el.get_text(strip=True) if title_el else None

    chapter_containers = []
    for tag in soup.find_all(True):
        classes = " ".join(tag.get("class", []))
        if any(kw in classes for kw in ["chapter", "part", "toc", "contents"]):
            chapter_containers.append({"tag": tag.name, "class": classes, "html": str(tag)[:300]})

    part_links = []
    for a in soup.select(f"a[href*='{fanfic_id}/']"):
        href = a.get("href", "")
        after = href.split(f"{fanfic_id}/")[-1].split("?")[0].strip("/")
        if after:
            part_links.append({"href": href, "part_id": after, "text": a.get_text(strip=True)[:50]})

    return {
        "title_text": title_text,
        "has_content_div": soup.select_one("div#content") is not None,
        "chapter_containers": chapter_containers[:10],
        "part_links": part_links[:15],
        "html_snippet": html[3000:7000],
    }
