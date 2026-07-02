import logging
import os
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from ficbook_parser.client import FicbookClient
    from ficbook_parser.models.sections import PopularSections, CategoriesSections
except ImportError:
    logger.warning("ficbook_parser not installed, scraping disabled")
    FicbookClient = None
    PopularSections = None
    CategoriesSections = None

# Sections to scrape on startup — using correct obfuscated paths
STARTUP_SECTIONS = [
    "popular-fanfics-376846",           # All popular
    "popular-fanfics-376846/het",
    "popular-fanfics-376846/slash-fics-ngf3487tnsfb",
    "popular-fanfics-376846/gen",
    "fanfiction/anime_and_manga",
    "fanfiction/books",
]


class ScraperService:
    def __init__(self):
        self._email = os.environ.get("FICBOOK_EMAIL", "")
        self._password = os.environ.get("FICBOOK_PASSWORD", "")

    def _make_client(self) -> "FicbookClient":
        return FicbookClient(timeout=30.0)

    async def scrape_popular(self, pages_per_section: int = 2) -> list[dict]:
        if not FicbookClient:
            logger.error("ficbook_parser not available")
            return []

        results = []
        async with self._make_client() as client:
            if self._email and self._password:
                auth_result = await client.auth.login(self._email, self._password)
                if auth_result.success:
                    logger.info(f"Authenticated as {auth_result.user.name if auth_result.user else 'unknown'}")
                else:
                    logger.warning(f"Auth failed: {auth_result.error} — scraping as guest")

            for section_path in STARTUP_SECTIONS:
                for page_num in range(1, pages_per_section + 1):
                    try:
                        fanfics, has_next = await client.fanfics_list.get(section_path, page=page_num)
                        logger.info(f"Scraped {len(fanfics)} fanfics from {section_path} page {page_num}")
                        for f in fanfics:
                            d = self._card_to_dict(f)
                            if d:
                                results.append(d)
                        await asyncio.sleep(1.0)
                        if not has_next:
                            break
                    except Exception as e:
                        logger.error(f"Failed scraping {section_path} page {page_num}: {e}")
                        break

        logger.info(f"Total scraped: {len(results)} fanfics")
        return results

    async def scrape_fanfic(self, fanfic_id: str) -> Optional[dict]:
        if not FicbookClient:
            return None
        async with self._make_client() as client:
            try:
                page = await client.fanfic_page.get(fanfic_id)
                return self._page_to_dict(page, fanfic_id)
            except Exception as e:
                logger.error(f"Failed to scrape fanfic {fanfic_id}: {e}")
                return None

    async def scrape_section(self, section_path: str, pages: int = 1) -> list[dict]:
        if not FicbookClient:
            return []
        results = []
        async with self._make_client() as client:
            for page_num in range(1, pages + 1):
                try:
                    fanfics, has_next = await client.fanfics_list.get(section_path, page=page_num)
                    for f in fanfics:
                        d = self._card_to_dict(f)
                        if d:
                            results.append(d)
                    await asyncio.sleep(1.0)
                    if not has_next:
                        break
                except Exception as e:
                    logger.error(f"Failed scraping {section_path} page {page_num}: {e}")
                    break
        return results

    def _page_to_dict(self, page, fanfic_id: str) -> dict:
        chapters_count = page.chapters.size if page.chapters else 0
        return {
            "id": fanfic_id,
            "title": page.name,
            "description": page.description,
            "author_name": page.authors[0].user.name if page.authors else "",
            "author_id": page.authors[0].user.id if page.authors else None,
            "fandoms": page.fandoms,
            "pairings": [{"characters": p.characters, "is_highlight": p.is_highlight} for p in page.pairings],
            "tags": [{"name": t.name, "is_adult": t.is_adult} for t in page.tags],
            "direction": page.direction.value,
            "rating": page.rating.value,
            "completion_status": page.status.status.value,
            "likes": page.likes,
            "trophies": page.trophies,
            "chapters_count": chapters_count,
            "comments_count": page.comments_count,
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
            "id": fanfic_id,
            "title": card.title,
            "description": card.description,
            "author_name": card.author.name if card.author else "",
            "author_id": card.author.id if card.author else None,
            "fandoms": card.fandoms,
            "pairings": [{"characters": p.characters} for p in card.pairings],
            "tags": [{"name": t.name, "is_adult": t.is_adult} for t in card.tags],
            "direction": card.status.direction.value,
            "rating": card.status.rating.value,
            "completion_status": card.status.status.value,
            "likes": card.status.likes,
            "trophies": card.status.trophies,
            "is_hot": card.status.is_hot,
            "cover_url": card.cover_url,
            "ficbook_url": ficbook_url,
        }
