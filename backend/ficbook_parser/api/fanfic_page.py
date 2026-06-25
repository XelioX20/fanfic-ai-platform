from __future__ import annotations
import httpx
import urllib.parse
from typing import Optional
from ..constants import FICBOOK_BASE_URL, ROUTE_READ_FIC
from ..models.fanfic import FanficPageModel
from ..parsers.fanfic_page import FanficPageParser


class FanficPageApi:
    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._parser = FanficPageParser()
        self._scraper_api_key = scraper_api_key

    def _build_url(self, fanfic_id: str, render_js: bool = False) -> str:
        target = f"{FICBOOK_BASE_URL}/{ROUTE_READ_FIC}/{fanfic_id}"
        if self._scraper_api_key:
            encoded = urllib.parse.quote(target, safe="")
            render = "true" if render_js else "false"
            return f"http://api.scraperapi.com/?api_key={self._scraper_api_key}&url={encoded}&render={render}"
        return target

    async def get(self, fanfic_id: str) -> FanficPageModel:
        # First try without JS render (faster, cheaper)
        url = self._build_url(fanfic_id, render_js=False)
        resp = await self._client.get(url)
        resp.raise_for_status()
        raw = resp.content.decode("utf-8", errors="replace")
        try:
            import ftfy
            html = ftfy.fix_text(raw)
        except ImportError:
            html = raw

        page = self._parser.parse(html, fanfic_id)

        # If no chapters found and it's a multi-chapter fanfic, retry with JS render
        if page.chapters is None and page.name and self._scraper_api_key:
            url_js = self._build_url(fanfic_id, render_js=True)
            try:
                resp2 = await self._client.get(url_js)
                resp2.raise_for_status()
                raw2 = resp2.content.decode("utf-8", errors="replace")
                try:
                    import ftfy
                    html2 = ftfy.fix_text(raw2)
                except ImportError:
                    html2 = raw2
                page2 = self._parser.parse(html2, fanfic_id)
                if page2.chapters is not None:
                    return page2
            except Exception:
                pass  # Fall back to original parse result

        return page
