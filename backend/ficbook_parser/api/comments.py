from __future__ import annotations
import httpx
from ..constants import FICBOOK_BASE_URL, ROUTE_READ_FIC
from ..models.comment import CommentModel
from ..parsers.comments import CommentsParser


class CommentsApi:
    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self._parser = CommentsParser()

    async def get_fanfic_comments(self, fanfic_id: str, page: int = 1) -> list[CommentModel]:
        url = f"{FICBOOK_BASE_URL}/{ROUTE_READ_FIC}/{fanfic_id}/comments?p={page}"
        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse(resp.text)
