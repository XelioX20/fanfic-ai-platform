import logging
import os
import asyncio
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

# Cloudflare Worker proxies ficbook.net HTML — not blocked unlike Render/Vercel IPs
WORKER_URL = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")

WORKER_HEADERS = {
    "User-Agent": "AppleWebKit/605.1",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9",
}

# Sections to scrape on startup
STARTUP_SECTIONS = [
    "fanfiction",
    "fanfiction?direction=het",
    "fanfiction?direction=slash",
    "fanfiction?direction=gen",
]


async def _fetch_via_worker(path: str, cookies: dict = None) -> Optional[str]:
    """Fetch ficbook.net HTML via Cloudflare Worker."""
    url = f"{WORKER_URL}/{path}"
    headers = dict(WORKER_HEADERS)
    if cookies:
        headers["x-ficbook-cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            raw = resp.content.decode("utf-8", errors="replace")
            try:
                import ftfy
                return ftfy.fix_text(raw)
            except ImportError:
                return raw
    except Exception as e:
        logger.error(f"Worker fetch failed for {path}: {e}")
        return None


class ScraperService:
    def __init__(self):
        self._email = os.environ.get("FICBOOK_EMAIL", "")
        self._password = os.environ.get("FICBOOK_PASSWORD", "")

    async def scrape_popular(self, pages_per_section: int = 2) -> list[dict]:
        results = []
        try:
            from ficbook_parser.parsers.fanfic_list import FanficListParser
        except ImportError:
            logger.error("ficbook_parser not available")
            return []

        for section_path in STARTUP_SECTIONS:
            for page_num in range(1, pages_per_section + 1):
                try:
                    path = f"{section_path}&p={page_num}" if "?" in section_path else f"{section_path}?p={page_num}"
                    html = await _fetch_via_worker(path)
                    if not html:
                        break
                    fanfics, has_next = FanficListParser().parse(html)
                    logger.info(f"Scraped {len(fanfics)} fanfics from {section_path} page {page_num}")
                    for f in fanfics:
                        d = self._card_to_dict(f)
                        if d:
                            results.append(d)
                    await asyncio.sleep(0.5)
                    if not has_next:
                        break
                except Exception as e:
                    logger.error(f"Failed scraping {section_path} page {page_num}: {e}")
                    break

        logger.info(f"Total scraped: {len(results)} fanfics")
        return results

    async def scrape_fanfic(self, fanfic_id: str) -> Optional[dict]:
        try:
            from ficbook_parser.parsers.fanfic_page import FanficPageParser
        except ImportError:
            return None
        html = await _fetch_via_worker(f"readfic/{fanfic_id}")
        if not html:
            return None
        parser = FanficPageParser()
        page = parser.parse(html, fanfic_id)
        return self._page_to_dict(page, fanfic_id)

    async def scrape_section(self, section_path: str, pages: int = 1) -> list[dict]:
        results = []
        try:
            from ficbook_parser.parsers.fanfic_list import FanficListParser
        except ImportError:
            return []
        for page_num in range(1, pages + 1):
            path = f"{section_path}&p={page_num}" if "?" in section_path else f"{section_path}?p={page_num}"
            html = await _fetch_via_worker(path)
            if not html:
                break
            fanfics, has_next = FanficListParser().parse(html)
            for f in fanfics:
                d = self._card_to_dict(f)
                if d:
                    results.append(d)
            await asyncio.sleep(0.5)
            if not has_next:
                break
        return results

    def _page_to_dict(self, page, fanfic_id: str) -> dict:
        chapters_count = page.chapters.size if page.chapters else 0
        return {
            "id": fanfic_id, "title": page.name, "description": page.description,
            "author_name": page.authors[0].user.name if page.authors else "",
            "author_id": page.authors[0].user.id if page.authors else None,
            "fandoms": page.fandoms,
            "pairings": [{"characters": p.characters, "is_highlight": p.is_highlight} for p in page.pairings],
            "tags": [{"name": t.name, "is_adult": t.is_adult} for t in page.tags],
            "direction": page.direction.value, "rating": page.rating.value,
            "completion_status": page.status.status.value,
            "likes": page.likes, "trophies": page.trophies,
            "chapters_count": chapters_count, "comments_count": page.comments_count,
            "cover_url": page.cover_url,
            "ficbook_url": f"https://ficbook.net/readfic/{fanfic_id}",
        }

    def _card_to_dict(self, card) -> Optional[dict]:
        href = card.href.split("?")[0] if card.href else ""
        ficbook_url = f"https://ficbook.net{href}" if href.startswith("/") else href
        fanfic_id = card.id
        if not fanfic_id and href:
            from ficbook_parser.parsers.utils import extract_id_from_href
            fanfic_id = extract_id_from_href(href)
        if not fanfic_id:
            return None
        return {
            "id": fanfic_id, "title": card.title, "description": card.description,
            "author_name": card.author.name if card.author else "",
            "author_id": card.author.id if card.author else None,
            "fandoms": card.fandoms,
            "pairings": [{"characters": p.characters} for p in card.pairings],
            "tags": [{"name": t.name, "is_adult": t.is_adult} for t in card.tags],
            "direction": card.status.direction.value, "rating": card.status.rating.value,
            "completion_status": card.status.status.value,
            "likes": card.status.likes, "trophies": card.status.trophies,
            "is_hot": card.status.is_hot, "cover_url": card.cover_url,
            "ficbook_url": ficbook_url,
            "size": card.size or "",
            "update_date": card.update_date or "",
        }
