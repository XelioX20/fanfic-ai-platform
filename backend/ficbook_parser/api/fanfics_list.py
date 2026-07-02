from __future__ import annotations
import asyncio
import httpx
from typing import Optional
from ..constants import FICBOOK_BASE_URL, QUERY_PAGE
from ..models.fanfic import FanficCardModel
from ..models.sections import Section, SectionWithQuery
from ..parsers.fanfic_list import FanficListParser


class FanficsListApi:
    """
    Fetch fanfic lists via direct HTTP — no proxy needed with AppleWebKit/605.1 UA.
    """

    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._parser = FanficListParser()

    def _build_url(self, path: str, page: int) -> str:
        target = f"{FICBOOK_BASE_URL}/{path}"
        sep = "&" if "?" in target else "?"
        return f"{target}{sep}{QUERY_PAGE}={page}"

    async def get(
        self,
        section,
        page: int = 1,
    ) -> tuple[list[FanficCardModel], bool]:
        path = str(section) if not isinstance(section, str) else section
        url = self._build_url(path, page)

        for attempt in range(3):
            try:
                resp = await self._client.get(url)
                if resp.status_code in (403, 429):
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                resp.raise_for_status()
                raw = resp.content.decode("utf-8", errors="replace")
                try:
                    import ftfy
                    html = ftfy.fix_text(raw)
                except ImportError:
                    html = raw
                return self._parser.parse(html)
            except httpx.HTTPStatusError:
                if attempt == 2:
                    raise
                await asyncio.sleep(2 * (attempt + 1))

        return [], False

    async def get_by_href(self, href: str, page: int = 1) -> tuple[list[FanficCardModel], bool]:
        return await self.get(href, page)
