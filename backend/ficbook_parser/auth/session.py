from __future__ import annotations
import httpx
import random
from dataclasses import dataclass
from typing import Optional
from bs4 import BeautifulSoup
from ..constants import FICBOOK_BASE_URL, ROUTE_SETTINGS
from ..models.user import UserModel
from ..parsers.utils import safe_attr, extract_id_from_href

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
    cookies: Optional[dict] = None


class FicbookAuth:
    LOGIN_ENDPOINT = f"{FICBOOK_BASE_URL}/login_check"

    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._scraper_api_key = scraper_api_key

    def _scraper_url(self, target: str, session_number: int, method: str = "GET", post_data: str = "") -> str:
        """Build ScraperAPI URL with persistent session so cookies carry across requests."""
        import urllib.parse
        encoded = urllib.parse.quote(target, safe="")
        url = (
            f"http://api.scraperapi.com/?api_key={self._scraper_api_key}"
            f"&url={encoded}&session_number={session_number}&render=false"
        )
        if method == "POST" and post_data:
            url += f"&method=POST&post_data={urllib.parse.quote(post_data, safe='')}"
        return url

    async def login(self, email: str, password: str) -> AuthResult:
        if self._scraper_api_key:
            return await self._login_via_scraperapi(email, password)
        return await self._login_direct(email, password)

    async def _login_via_scraperapi(self, email: str, password: str) -> AuthResult:
        """
        Uses ScraperAPI sessions (session_number) to persist cookies across requests,
        bypassing Cloudflare on Render's blocked IPs.
        """
        session_number = random.randint(1, 9999)
        try:
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS,
                timeout=60.0,
                follow_redirects=True,
            ) as client:
                # Step 1: GET login page via ScraperAPI session → get CSRF token
                login_page_url = self._scraper_url(
                    f"{FICBOOK_BASE_URL}/login", session_number
                )
                resp = await client.get(login_page_url)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")
                csrf = self._extract_csrf(soup)

                if not csrf:
                    return AuthResult(success=False, error="Could not extract CSRF token")

                # Step 2: POST credentials via same ScraperAPI session → cookies persist
                import urllib.parse
                post_body = urllib.parse.urlencode({
                    "login": email,
                    "password": password,
                    "_csrf_token": csrf,
                })
                post_url = self._scraper_url(
                    self.LOGIN_ENDPOINT, session_number,
                    method="POST", post_data=post_body,
                )
                await client.get(post_url)  # ScraperAPI POST uses GET with method=POST param

                # Step 3: Verify authorization via same session
                settings_url = self._scraper_url(
                    f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}", session_number
                )
                check_resp = await client.get(settings_url)

                # If redirected to login — not authorized
                if "login" in check_resp.url.path or "login" in check_resp.text[:500]:
                    return AuthResult(success=False, error="Login failed: invalid credentials")

                # Step 4: Get user profile
                home_url = self._scraper_url(f"{FICBOOK_BASE_URL}/home", session_number)
                home_resp = await client.get(home_url)
                soup2 = BeautifulSoup(home_resp.text, "html.parser")
                user = self._parse_user(soup2)

                return AuthResult(success=True, user=user)

        except httpx.HTTPError as e:
            return AuthResult(success=False, error=str(e))

    async def _login_direct(self, email: str, password: str) -> AuthResult:
        """Direct login without proxy — works only when IP is not blocked by Cloudflare."""
        try:
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS,
                timeout=30.0,
                follow_redirects=True,
            ) as direct:
                resp = await direct.get(f"{FICBOOK_BASE_URL}/login")
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")
                csrf = self._extract_csrf(soup)

                await direct.post(
                    self.LOGIN_ENDPOINT,
                    data={"login": email, "password": password, "_csrf_token": csrf},
                    follow_redirects=True,
                )

                check_resp = await direct.get(
                    f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}",
                    follow_redirects=False,
                )
                if check_resp.status_code in (301, 302):
                    if "login" in check_resp.headers.get("location", ""):
                        return AuthResult(success=False, error="Login failed: invalid credentials")
                elif check_resp.status_code != 200:
                    return AuthResult(success=False, error="Login failed: invalid credentials")

                home_resp = await direct.get(f"{FICBOOK_BASE_URL}/home")
                user = self._parse_user(BeautifulSoup(home_resp.text, "html.parser"))

                # Copy cookies to shared client
                for cookie in direct.cookies.jar:
                    self._client.cookies.set(cookie.name, cookie.value, domain=cookie.domain)

                return AuthResult(success=True, user=user)

        except httpx.HTTPError as e:
            return AuthResult(success=False, error=str(e))

    async def check_authorized(self) -> bool:
        try:
            resp = await self._client.get(
                f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}",
                follow_redirects=False,
            )
            if resp.status_code in (301, 302):
                return "login" not in resp.headers.get("location", "")
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

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
