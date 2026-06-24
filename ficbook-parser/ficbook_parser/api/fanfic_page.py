from __future__ import annotations
import httpx
from ..constants import FICBOOK_BASE_URL, ROUTE_READ_FIC
from ..models.fanfic import FanficPageModel
from ..parsers.fanfic_page import FanficPageParser


class FanficPageApi:
    """Ports B1ays FanficPageApi.kt."""

    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self._parser = FanficPageParser()

    async def get(self, fanfic_id: str) -> FanficPageModel:
        url = f"{FICBOOK_BASE_URL}/{ROUTE_READ_FIC}/{fanfic_id}"
        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse(resp.text, fanfic_id=fanfic_id)
