from __future__ import annotations
import httpx
from ..constants import FICBOOK_BASE_URL
from ..models.collection import CollectionModel
from ..parsers.collections import CollectionsParser


class CollectionsApi:
    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self._parser = CollectionsParser()

    async def get_collections(self, page: int = 1) -> list[CollectionModel]:
        url = f"{FICBOOK_BASE_URL}/collections?p={page}"
        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse_list(resp.text)

    async def get_user_collections(self, user_id: str, page: int = 1) -> list[CollectionModel]:
        url = f"{FICBOOK_BASE_URL}/authors/{user_id}/collections?p={page}"
        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse_list(resp.text)
