from __future__ import annotations
import httpx
from typing import Optional
from ..constants import FICBOOK_BASE_URL, ROUTE_READ_FIC
from ..models.fanfic import FanficPageModel
from ..parsers.fanfic_page import FanficPageParser


class FanficPageApi:
    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._parser = FanficPageParser()
        self._scraper_api_key = scraper_api_key

    def _build_url(self, fanfic_id: str) -> str:
        target = f"{FICBOOK_BASE_URL}/{ROUTE_READ_FIC}/{fanfic_id}"
        if self._scraper_api_key:
            import urllib.parse
            encoded = urllib.parse.quote(target, safe="")
            return f"http://api.scraperapi.com/?api_key={self._scraper_api_key}&url={encoded}"
        return target

    async def get(self, fanfic_id: str) -> FanficPageModel:
        url = self._build_url(fanfic_id)
        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse(resp.text, fanfic_id)
