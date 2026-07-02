from __future__ import annotations
import asyncio
import httpx
from typing import Optional
from ..constants import FICBOOK_BASE_URL, ROUTE_FIND, QUERY_SEARCH, QUERY_PAGE, SEARCH_FANDOMS, SEARCH_TAGS
from ..parsers.fanfic_list import FanficListParser


class SearchApi:
    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._parser = FanficListParser()

    async def search(self, query: str, page: int = 1):
        """Full-text fanfic search — returns HTML, parse with FanficListParser."""
        import urllib.parse
        url = f"{FICBOOK_BASE_URL}/{ROUTE_FIND}?{QUERY_SEARCH}={urllib.parse.quote(query)}&{QUERY_PAGE}={page}"
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

    async def search_fandoms(self, query: str, page: int = 1) -> dict:
        """POST /fandoms/search — returns JSON directly."""
        resp = await self._client.post(
            f"{FICBOOK_BASE_URL}/{SEARCH_FANDOMS}",
            data={"group_id": "", "show_empty": "false", "show_originals": "false", "q": query, "page": page},
        )
        resp.raise_for_status()
        return resp.json()

    async def search_tags(self, query: str, page: int = 1) -> dict:
        """POST /tags/search — returns JSON directly."""
        resp = await self._client.post(
            f"{FICBOOK_BASE_URL}/{SEARCH_TAGS}",
            data={"title": query, "page": page},
        )
        resp.raise_for_status()
        return resp.json()
