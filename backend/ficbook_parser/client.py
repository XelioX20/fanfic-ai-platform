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

# Exact User-Agent used by B1ays/ficbook-reader — avoids Cloudflare 403
DEFAULT_HEADERS = {
    "User-Agent": "AppleWebKit/605.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Referer": "https://ficbook.net/",
}


class FicbookClient:
    """
    Async client for ficbook.net — direct HTTP, no proxy required.
    Uses AppleWebKit/605.1 User-Agent as confirmed by B1ays/ficbook-reader reverse engineering.
    Auth is cookie-based: PHPSESSID + rme cookies only.
    """

    def __init__(
        self,
        cookies: Optional[dict] = None,
        timeout: float = 30.0,
        rate_limit_delay: float = 1.0,
        # Kept for backward compat but ignored — no proxy needed
        scraper_api_key: Optional[str] = None,
    ):
        self._rate_limit_delay = rate_limit_delay
        self._http = httpx.AsyncClient(
            headers=DEFAULT_HEADERS,
            cookies=cookies or {},
            timeout=timeout,
            follow_redirects=True,
        )

        self.auth = FicbookAuth(self._http)
        self.fanfics_list = FanficsListApi(self._http)
        self.fanfic_page = FanficPageApi(self._http)
        self.chapters = ChaptersApi(self._http)
        self.collections = CollectionsApi(self._http)
        self.comments = CommentsApi(self._http)
        self.search = SearchApi(self._http)
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
