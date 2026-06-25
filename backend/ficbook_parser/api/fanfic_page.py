from __future__ import annotations
import httpx
import urllib.parse
from typing import Optional
from ..constants import FICBOOK_BASE_URL, ROUTE_READ_FIC
from ..models.fanfic import FanficPageModel
from ..parsers.fanfic_page import FanficPageParser
from ..proxy import proxy_url


class FanficPageApi:
    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._parser = FanficPageParser()

    def _build_url(self, fanfic_id: str) -> str:
        target = f"{FICBOOK_BASE_URL}/{ROUTE_READ_FIC}/{fanfic_id}"
        return proxy_url(target) or target

    async def get(self, fanfic_id: str) -> FanficPageModel:
        url = self._build_url(fanfic_id)
        resp = await self._client.get(url)
        resp.raise_for_status()
        raw = resp.content.decode("utf-8", errors="replace")
        try:
            import ftfy
            html = ftfy.fix_text(raw)
        except ImportError:
            html = raw
        return self._parser.parse(html, fanfic_id)
