from __future__ import annotations
import httpx
from typing import Optional
from .auth.session import FicbookAuth, AuthResult
from .api.fanfics_list import FanficsListApi
from .api.fanfic_page import FanficPageApi
from .api.chapters import ChaptersApi
from .api.collections import CollectionsApi
from .api.comments import CommentsApi
from .api.search import SearchApi
from .api.author_profile import AuthorProfileApi
from .api.notifications import NotificationsApi
from .api.users import UsersApi
from .models.sections import Section, SectionWithQuery, PopularSections


DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://ficbook.net/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Ch-Ua": '"Chromium";v="125", "Google Chrome";v="125"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
    "Connection": "keep-alive",
}

SCRAPERAPI_BASE = "http://api.scraperapi.com"


class FicbookClient:
    """
    Main async client for ficbook.net.
    Architecture mirrors B1ays/ficbook-reader ficbookApi module.

    Pass scraper_api_key to route all requests through ScraperAPI,
    which handles Cloudflare protection automatically.

    Usage:
        async with FicbookClient(scraper_api_key="KEY") as client:
            fanfics, has_next = await client.fanfics_list.get(PopularSections.ALL)
    """

    def __init__(
        self,
        cookies: Optional[dict] = None,
        timeout: float = 60.0,
        rate_limit_delay: float = 1.0,
        scraper_api_key: Optional[str] = None,
    ):
        self._scraper_api_key = scraper_api_key
        self._rate_limit_delay = rate_limit_delay

        # Always use a plain client — ScraperAPI URL wrapping is done per-request in each API module
        self._http = httpx.AsyncClient(
            headers=DEFAULT_HEADERS,
            cookies=cookies or {},
            timeout=timeout,
            follow_redirects=True,
        )

        self.auth = FicbookAuth(self._http, scraper_api_key=scraper_api_key)
        self.fanfics_list = FanficsListApi(self._http, scraper_api_key=scraper_api_key)
        self.fanfic_page = FanficPageApi(self._http, scraper_api_key=scraper_api_key)
        self.chapters = ChaptersApi(self._http, scraper_api_key=scraper_api_key)
        self.collections = CollectionsApi(self._http)
        self.comments = CommentsApi(self._http)
        self.search = SearchApi(self._http, scraper_api_key=scraper_api_key)
        self.author_profile = AuthorProfileApi(self._http)
        self.notifications = NotificationsApi(self._http)
        self.users = UsersApi(self._http)

    async def login(self, email: str, password: str) -> AuthResult:
        return await self.auth.login(email, password)

    async def is_authorized(self) -> bool:
        return await self.auth.check_authorized()

    async def __aenter__(self) -> "FicbookClient":
        return self

    async def __aexit__(self, *args) -> None:
        await self._http.aclose()

    async def close(self) -> None:
        await self._http.aclose()
