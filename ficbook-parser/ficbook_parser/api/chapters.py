from __future__ import annotations
import httpx
from ..constants import FICBOOK_BASE_URL, ROUTE_READ_FIC
from ..models.fanfic import ChapterModel
from ..parsers.chapter import ChapterParser


class ChaptersApi:
    """Ports B1ays ChaptersApi.kt."""

    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self._parser = ChapterParser()

    async def get_chapter(self, fanfic_id: str, part_id: str) -> ChapterModel:
        url = f"{FICBOOK_BASE_URL}/{ROUTE_READ_FIC}/{fanfic_id}/{part_id}"
        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse(resp.text, chapter_id=part_id)
