from __future__ import annotations
import asyncio
import httpx
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

        # Retry up to 3 times with increasing delay on 403/429
        for attempt in range(3):
            try:
                resp = await self._client.get(url)
                if resp.status_code in (403, 429):
                    await asyncio.sleep(3 * (attempt + 1))
                    continue
                resp.raise_for_status()
                return self._parser.parse(resp.text)
            except httpx.HTTPStatusError:
                if attempt == 2:
                    raise
                await asyncio.sleep(3 * (attempt + 1))

        return [], False

    async def get_by_href(self, href: str, page: int = 1) -> tuple[list[FanficCardModel], bool]:
        return await self.get(href, page)
