from __future__ import annotations
import httpx
from ..constants import FICBOOK_BASE_URL, ROUTE_AUTHORS
from ..models.author import AuthorProfileModel
from ..parsers.author import AuthorProfileParser


class AuthorProfileApi:
    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self._parser = AuthorProfileParser()

    async def get(self, author_id: str) -> AuthorProfileModel:
        url = f"{FICBOOK_BASE_URL}/{ROUTE_AUTHORS}/{author_id}"
        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse(resp.text, author_id=author_id)
