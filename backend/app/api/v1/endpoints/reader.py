import os
import logging
import urllib.parse
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY", "")


def _wrap_url(url: str) -> str:
    if SCRAPER_API_KEY:
        encoded = urllib.parse.quote(url, safe="")
        return f"http://api.scraperapi.com/?api_key={SCRAPER_API_KEY}&url={encoded}"
    return url


async def _fetch_html(url: str) -> str:
    async with httpx.AsyncClient(
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
        timeout=60.0,
        follow_redirects=True,
    ) as client:
        resp = await client.get(_wrap_url(url))
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


@router.get("/fanfics/{fanfic_id}/full", response_model=FanficFullResponse)
async def get_fanfic_full(fanfic_id: str):
    """Fetch full fanfic metadata + chapter list live from ficbook.net."""
    try:
        from ficbook_parser.client import FicbookClient
        scraper_key = SCRAPER_API_KEY or None
        async with FicbookClient(scraper_api_key=scraper_key) as client:
            page = await client.fanfic_page.get(fanfic_id)
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

    return FanficFullResponse(
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
        authors=[{"name": a.user.name, "id": a.user.id, "href": a.user.href, "role": a.role} for a in page.authors],
        fandoms=page.fandoms,
        pairings=[{"characters": p.characters, "is_highlight": p.is_highlight} for p in page.pairings],
        tags=[{"name": t.name, "is_adult": t.is_adult} for t in page.tags],
        chapters=chapters,
        is_single_chapter=is_single,
        single_chapter_html=single_html,
    )


@router.get("/fanfics/{fanfic_id}/chapter/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(fanfic_id: str, chapter_id: str, all_chapters: str = ""):
    """Fetch a specific chapter content live from ficbook.net."""
    try:
        from ficbook_parser.client import FicbookClient
        scraper_key = SCRAPER_API_KEY or None
        async with FicbookClient(scraper_api_key=scraper_key) as client:
            chapter = await client.chapters.get_chapter(fanfic_id, chapter_id)
    except Exception as e:
        logger.error(f"Failed to fetch chapter {chapter_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch chapter: {e}")

    # Parse prev/next from comma-separated chapter_ids passed as query param
    prev_id = None
    next_id = None
    if all_chapters:
        ids = all_chapters.split(",")
        try:
            idx = ids.index(chapter_id)
            prev_id = ids[idx - 1] if idx > 0 else None
            next_id = ids[idx + 1] if idx < len(ids) - 1 else None
        except ValueError:
            pass

    return ChapterResponse(
        id=chapter.id,
        fanfic_id=fanfic_id,
        title=chapter.title,
        date=chapter.date,
        words_count=chapter.words_count,
        html=chapter.text or "",
        prev_chapter_id=prev_id,
        next_chapter_id=next_id,
    )


@router.get("/fanfics/{fanfic_id}/debug-html")
async def debug_fanfic_html(fanfic_id: str):
    """Return raw HTML snippet from ficbook.net fanfic page for debugging selectors."""
    target = f"https://ficbook.net/readfic/{fanfic_id}"
    html = await _fetch_html(target)
    try:
        import ftfy
        html = ftfy.fix_text(html)
    except ImportError:
        pass
    from bs4 import BeautifulSoup
    import re
    soup = BeautifulSoup(html, "html.parser")

    # Find all elements that look like chapter lists
    chapter_containers = []
    for tag in soup.find_all(True):
        classes = " ".join(tag.get("class", []))
        if any(kw in classes for kw in ["chapter", "part", "toc", "contents"]):
            chapter_containers.append({"tag": tag.name, "class": classes, "html": str(tag)[:300]})

    # Find readfic links with part_ids (numeric or uuid after fanfic_id)
    part_links = []
    for a in soup.select(f"a[href*='{fanfic_id}/']"):
        href = a.get("href", "")
        part_id = href.split(f"{fanfic_id}/")[-1].split("?")[0].strip("/")
        if part_id:
            part_links.append({"href": href, "part_id": part_id, "class": " ".join(a.get("class", [])), "text": a.get_text(strip=True)[:50]})

    return {
        "title": soup.select_one("h1[itemprop=name], h1.heading, h1.fanfic-main-info"),
        "title_text": safe_text(soup.select_one("h1[itemprop=name], h1.heading, h1.fanfic-main-info")),
        "has_content_div": soup.select_one("div#content") is not None,
        "has_articleBody": soup.select_one("[itemprop=articleBody]") is not None,
        "chapter_containers": chapter_containers[:10],
        "part_links": part_links[:15],
        "html_start": html[:3000],
        "html_mid": html[8000:11000],
    }
