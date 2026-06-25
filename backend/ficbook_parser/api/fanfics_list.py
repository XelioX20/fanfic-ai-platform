from __future__ import annotations
import asyncio
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
    Supports ScraperAPI proxy for Cloudflare bypass.
    """

    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._parser = FanficListParser()
        self._scraper_api_key = scraper_api_key

    def _build_url(self, path: str, page: int) -> str:
        target = f"{FICBOOK_BASE_URL}/{path}"
        if "?" in target:
            target += f"&{QUERY_PAGE}={page}"
        else:
            target += f"?{QUERY_PAGE}={page}"

        if self._scraper_api_key:
            import urllib.parse
            encoded = urllib.parse.quote(target, safe="")
            return f"http://api.scraperapi.com/?api_key={self._scraper_api_key}&url={encoded}"
        return target

    async def get(
        self,
        section: Section | SectionWithQuery | str,
        page: int = 1,
    ) -> tuple[list[FanficCardModel], bool]:
        """Returns (fanfics, has_next_page)."""
        path = str(section) if not isinstance(section, str) else section
        url = self._build_url(path, page)

        for attempt in range(3):
            try:
                resp = await self._client.get(url)
                if resp.status_code in (403, 429):
                    await asyncio.sleep(3 * (attempt + 1))
                    continue
                resp.raise_for_status()
                # ScraperAPI may return bytes with wrong charset detection
                # Try UTF-8 first, then latin-1 re-encoded
                raw = resp.content
                try:
                    html = raw.decode("utf-8")
                except UnicodeDecodeError:
                    html = raw.decode("latin-1").encode("latin-1").decode("utf-8", errors="replace")
                # If still garbled (surrogate chars), use chardet or fallback
                if "\udcff" in html or "\udc80" in html:
                    # Try treating as latin-1 bytes re-interpreted as utf-8
                    try:
                        html = raw.decode("latin-1")
                        # re-encode and decode to fix double-encoding
                        html = html.encode("latin-1").decode("utf-8")
                    except Exception:
                        html = raw.decode("utf-8", errors="replace")
                return self._parser.parse(html)
            except httpx.HTTPStatusError:
                if attempt == 2:
                    raise
                await asyncio.sleep(3 * (attempt + 1))

        return [], False

    async def get_by_href(self, href: str, page: int = 1) -> tuple[list[FanficCardModel], bool]:
        return await self.get(href, page)
