from __future__ import annotations
import httpx
import ftfy
from typing import Optional
from ..constants import FICBOOK_BASE_URL, ROUTE_READ_FIC
from ..models.fanfic import ChapterModel
from ..parsers.chapter import ChapterParser


class ChaptersApi:
    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._parser = ChapterParser()
        self._scraper_api_key = scraper_api_key

    def _build_url(self, fanfic_id: str, part_id: str) -> str:
        target = f"{FICBOOK_BASE_URL}/{ROUTE_READ_FIC}/{fanfic_id}/{part_id}"
        if self._scraper_api_key:
            import urllib.parse
            encoded = urllib.parse.quote(target, safe="")
            return f"http://api.scraperapi.com/?api_key={self._scraper_api_key}&url={encoded}"
        return target

    async def get_chapter(self, fanfic_id: str, part_id: str) -> ChapterModel:
        url = self._build_url(fanfic_id, part_id)
        resp = await self._client.get(url)
        resp.raise_for_status()
        raw = resp.content.decode("utf-8", errors="replace")
        try:
            html = ftfy.fix_text(raw)
        except ImportError:
            html = raw
        return self._parser.parse(html, part_id)
