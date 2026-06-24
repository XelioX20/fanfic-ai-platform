from __future__ import annotations
import httpx
from ..constants import FICBOOK_BASE_URL, ROUTE_AUTHORS
from ..models.user import UserModel
from ..parsers.user import UserParser


class UsersApi:
    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self._parser = UserParser()

    async def get(self, user_id: str) -> UserModel:
        url = f"{FICBOOK_BASE_URL}/{ROUTE_AUTHORS}/{user_id}"
        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse(resp.text, user_id=user_id)
