from __future__ import annotations
import httpx
from typing import Optional
from ..constants import FICBOOK_BASE_URL, ROUTE_FIND, QUERY_SEARCH, QUERY_PAGE
from ..models.search import SearchResult
from ..parsers.fanfic_list import FanficListParser


class SearchApi:
    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._parser = FanficListParser()
        self._scraper_api_key = scraper_api_key

    def _build_url(self, query: str, page: int) -> str:
        target = f"{FICBOOK_BASE_URL}/{ROUTE_FIND}?{QUERY_SEARCH}={query}&{QUERY_PAGE}={page}"
        if self._scraper_api_key:
            import urllib.parse
            encoded = urllib.parse.quote(target)
            return f"/?api_key={self._scraper_api_key}&url={encoded}"
        return target

    async def search(self, query: str, page: int = 1):
        url = self._build_url(query, page)
        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse(resp.text)
