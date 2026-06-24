from __future__ import annotations
import httpx
from typing import Optional
from ..constants import FICBOOK_BASE_URL, QUERY_PAGE
from ..models.fanfic import FanficCardModel
from ..models.sections import Section, SectionWithQuery
from ..parsers.fanfic_list import FanficListParser


class FanficsListApi:
    """
    Ports B1ays FanficsListApi.kt.
    Fetches paginated fanfic lists from section/search pages.
    """

    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self._parser = FanficListParser()

    async def get(
        self,
        section: Section | SectionWithQuery | str,
        page: int = 1,
    ) -> tuple[list[FanficCardModel], bool]:
        """Returns (fanfics, has_next_page)."""
        if isinstance(section, str):
            path = section
        else:
            path = str(section)

        url = f"{FICBOOK_BASE_URL}/{path}"
        if "?" in url:
            url += f"&{QUERY_PAGE}={page}"
        else:
            url += f"?{QUERY_PAGE}={page}"

        resp = await self._client.get(url)
        resp.raise_for_status()
        return self._parser.parse(resp.text)

    async def get_by_href(self, href: str, page: int = 1) -> tuple[list[FanficCardModel], bool]:
        return await self.get(href, page)
