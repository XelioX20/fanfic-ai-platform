from __future__ import annotations
import asyncio
import httpx
from typing import Optional
from ..constants import FICBOOK_BASE_URL, ROUTE_FIND, QUERY_SEARCH, QUERY_PAGE
from ..parsers.fanfic_list import FanficListParser
from ..proxy import proxy_url


class SearchApi:
    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._parser = FanficListParser()

    def _build_url(self, query: str, page: int) -> str:
        import urllib.parse
        target = f"{FICBOOK_BASE_URL}/{ROUTE_FIND}?{QUERY_SEARCH}={urllib.parse.quote(query)}&{QUERY_PAGE}={page}"
        return proxy_url(target) or target

    async def search(self, query: str, page: int = 1):
        url = self._build_url(query, page)
        for attempt in range(3):
            try:
                resp = await self._client.get(url)
                if resp.status_code in (403, 429):
                    await asyncio.sleep(3 * (attempt + 1))
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
                await asyncio.sleep(3 * (attempt + 1))
        return [], False
