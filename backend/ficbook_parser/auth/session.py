from __future__ import annotations
import httpx
from dataclasses import dataclass
from typing import Optional
from bs4 import BeautifulSoup
from ..constants import FICBOOK_BASE_URL, LOGIN_URL, ROUTE_SETTINGS
from ..models.user import UserModel
from ..parsers.utils import safe_text, safe_attr, extract_id_from_href

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Referer": "https://ficbook.net/",
}


@dataclass
class AuthResult:
    success: bool
    user: Optional[UserModel] = None
    error: Optional[str] = None


class FicbookAuth:
    LOGIN_ENDPOINT = f"{FICBOOK_BASE_URL}/login_check"

    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._scraper_api_key = scraper_api_key

    def _wrap(self, url: str) -> str:
        if self._scraper_api_key:
            import urllib.parse
            encoded = urllib.parse.quote(url, safe="")
            return f"http://api.scraperapi.com/?api_key={self._scraper_api_key}&url={encoded}"
        return url

    async def login(self, email: str, password: str) -> AuthResult:
        """
        Auth flow always uses direct requests (no ScraperAPI) because
        ScraperAPI does not forward Set-Cookie headers to the httpx session,
        so cookies from login_check never reach check_authorized().
        """
        try:
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS,
                timeout=30.0,
                follow_redirects=True,
            ) as direct:
                # Step 1: GET login page to extract CSRF token
                resp = await direct.get(f"{FICBOOK_BASE_URL}/login")
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")
                csrf = self._extract_csrf(soup)

                # Step 2: POST credentials
                form_data = {
                    "login": email,
                    "password": password,
                    "_csrf_token": csrf,
                }
                await direct.post(
                    self.LOGIN_ENDPOINT,
                    data=form_data,
                    follow_redirects=True,
                )

                # Step 3: Verify by checking settings page redirect
                check_resp = await direct.get(
                    f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}",
                    follow_redirects=False,
                )
                if check_resp.status_code in (301, 302):
                    location = check_resp.headers.get("location", "")
                    if "login" in location:
                        return AuthResult(success=False, error="Login failed: invalid credentials")
                elif check_resp.status_code != 200:
                    return AuthResult(success=False, error="Login failed: invalid credentials")

                # Step 4: Get user profile
                home_resp = await direct.get(f"{FICBOOK_BASE_URL}/home")
                soup2 = BeautifulSoup(home_resp.text, "html.parser")
                user = self._parse_user(soup2)

                # Step 5: Copy cookies to the shared client for subsequent requests
                for cookie in direct.cookies.jar:
                    self._client.cookies.set(cookie.name, cookie.value, domain=cookie.domain)

                return AuthResult(success=True, user=user)

        except httpx.HTTPError as e:
            return AuthResult(success=False, error=str(e))

    async def check_authorized(self) -> bool:
        try:
            resp = await self._client.get(
                self._wrap(f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}"),
                follow_redirects=False,
            )
            if resp.status_code in (301, 302):
                location = resp.headers.get("location", "")
                return "login" not in location
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def _get_current_user(self) -> Optional[UserModel]:
        try:
            resp = await self._client.get(self._wrap(f"{FICBOOK_BASE_URL}/home"))
            soup = BeautifulSoup(resp.text, "html.parser")
            return self._parse_user(soup)
        except Exception:
            pass
        return None

    def _parse_user(self, soup: BeautifulSoup) -> Optional[UserModel]:
        user_link = soup.select_one("a.user-name-avatar, a[href*='/authors/']")
        if user_link:
            href = user_link.get("href", "")
            name = user_link.get_text(strip=True)
            user_id = extract_id_from_href(href)
            avatar = soup.select_one("img.user-avatar-img")
            avatar_url = avatar.get("src", "") if avatar else None
            return UserModel(id=user_id, name=name, href=href, avatar_url=avatar_url)
        return None

    @staticmethod
    def _extract_csrf(soup: BeautifulSoup) -> str:
        token = soup.select_one("input[name=_csrf_token]")
        return safe_attr(token, "value") if token else ""
