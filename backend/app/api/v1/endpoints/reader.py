import logging
import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

WORKER_URL = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")

async def _fetch_html(url: str) -> str:
    """Fetch ficbook.net HTML via Cloudflare Worker (bypasses datacenter IP blocking)."""
    import httpx, re
    # Convert ficbook.net URL to Worker URL
    ficbook_path = re.sub(r'^https?://ficbook\.net/', '', url)
    worker_url = f"{WORKER_URL}/{ficbook_path}"

    async with httpx.AsyncClient(
        headers={
            "User-Agent": "AppleWebKit/605.1",
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9",
        },
        timeout=60.0,
        follow_redirects=True,
    ) as client:
        resp = await client.get(worker_url)
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
    """Fetch full fanfic metadata + chapter list via Cloudflare Worker."""
    try:
        html = await _fetch_html(f"https://ficbook.net/readfic/{fanfic_id}")
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


@router.get("/fanfics/{fanfic_id}/chapter/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(fanfic_id: str, chapter_id: str, all_chapters: str = ""):
    """Fetch chapter content via Cloudflare Worker."""
    try:
        clean_id = chapter_id.split("#")[0].strip("/")
        html = await _fetch_html(f"https://ficbook.net/readfic/{fanfic_id}/{clean_id}")
        from ficbook_parser.parsers.chapter import ChapterParser
        chapter = ChapterParser().parse(html, clean_id)
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


@router.get("/fanfics/{fanfic_id}/debug-scripts")
async def debug_scripts(fanfic_id: str):
    """Show script tag contents from fanfic page to find embedded chapter data."""
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
    scripts = []
    for s in soup.find_all("script"):
        text = s.string or ""
        if any(kw in text for kw in ["parts", "chapters", "chapter", "part_id", "readfic"]):
            scripts.append(text[:500])
    return {"script_count": len(scripts), "scripts": scripts[:5]}


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

