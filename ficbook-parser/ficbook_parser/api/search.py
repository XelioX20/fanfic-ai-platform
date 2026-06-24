from __future__ import annotations
import json
import httpx
from ..constants import FICBOOK_BASE_URL
from ..models.search import FandomModel, CharacterModel, TagSearchResult


class SearchApi:
    """
    Ports B1ays SearchApi.kt.
    POST endpoints for autocomplete search of fandoms, characters, tags.
    """

    FANDOMS_SEARCH_URL = f"{FICBOOK_BASE_URL}/fanfiction/fandoms-autocomplete"
    CHARACTERS_URL = f"{FICBOOK_BASE_URL}/fanfiction/characters-autocomplete"
    TAGS_SEARCH_URL = f"{FICBOOK_BASE_URL}/tags/autocomplete"

    def __init__(self, client: httpx.AsyncClient):
        self._client = client

    async def find_fandoms(self, query: str) -> list[FandomModel]:
        try:
            resp = await self._client.post(
                self.FANDOMS_SEARCH_URL,
                data={"query": query},
            )
            resp.raise_for_status()
            data = resp.json()
            return [
                FandomModel(id=str(f.get("id", "")), name=f.get("title", ""), href=f.get("url", ""))
                for f in (data if isinstance(data, list) else data.get("fandoms", []))
            ]
        except Exception:
            return []

    async def get_characters(self, fandom_ids: list[str]) -> list[CharacterModel]:
        try:
            resp = await self._client.post(
                self.CHARACTERS_URL,
                data={"fandom_ids[]": fandom_ids},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data if isinstance(data, list) else data.get("characters", [])
            return [
                CharacterModel(id=str(c.get("id", "")), name=c.get("name", ""))
                for c in items
            ]
        except Exception:
            return []

    async def find_tags(self, query: str) -> list[TagSearchResult]:
        try:
            resp = await self._client.post(
                self.TAGS_SEARCH_URL,
                data={"query": query},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data if isinstance(data, list) else data.get("tags", [])
            return [
                TagSearchResult(
                    id=str(t.get("id", "")),
                    name=t.get("title", t.get("name", "")),
                    fanfics_count=int(t.get("count", 0)),
                )
                for t in items
            ]
        except Exception:
            return []
