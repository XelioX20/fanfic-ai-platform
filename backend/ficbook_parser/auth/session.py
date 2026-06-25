from __future__ import annotations
import httpx
import random
from dataclasses import dataclass, field
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

SCRAPERAPI_BASE = "http://api.scraperapi.com/"


@dataclass
class AuthResult:
    success: bool
    user: Optional[UserModel] = None
    error: Optional[str] = None
    cookies: dict = field(default_factory=dict)


class FicbookAuth:
    LOGIN_ENDPOINT = f"{FICBOOK_BASE_URL}/login_check"

    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client
        self._scraper_api_key = scraper_api_key

    async def login(self, email: str, password: str) -> AuthResult:
        if self._scraper_api_key:
            return await self._login_via_scraperapi(email, password)
        return await self._login_direct(email, password)

    async def _decode(self, resp: httpx.Response) -> str:
        html = resp.content.decode("utf-8", errors="replace")
        try:
            import ftfy
            html = ftfy.fix_text(html)
        except ImportError:
            pass
        return html

    def _collect_cookies(self, resp: httpx.Response, jar: dict) -> None:
        """Extract Set-Cookie headers and merge into jar."""
        for name, value in resp.headers.multi_items():
            if name.lower() == "set-cookie":
                part = value.split(";")[0].strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    jar[k.strip()] = v.strip()

    def _cookie_header(self, jar: dict) -> str:
        return "; ".join(f"{k}={v}" for k, v in jar.items())

    async def _login_via_scraperapi(self, email: str, password: str) -> AuthResult:
        """
        Login through ScraperAPI to bypass Cloudflare.
        ScraperAPI forwards Cookie headers we set and returns Set-Cookie headers.
        We manually track cookies across requests.
        """
        session_number = random.randint(1, 9999)
        base_params = {
            "api_key": self._scraper_api_key,
            "session_number": session_number,
            "render": "false",
        }
        jar: dict = {}

        try:
            async with httpx.AsyncClient(
                timeout=60.0,
                follow_redirects=False,
            ) as client:
                # --- Step 1: GET login page → extract CSRF token + initial cookies ---
                r1 = await client.get(
                    SCRAPERAPI_BASE,
                    params={**base_params, "url": f"{FICBOOK_BASE_URL}/login"},
                    headers=DEFAULT_HEADERS,
                )
                self._collect_cookies(r1, jar)
                html1 = await self._decode(r1)
                soup1 = BeautifulSoup(html1, "html.parser")
                csrf = self._extract_csrf(soup1)

                # --- Step 2: POST credentials with collected cookies ---
                post_headers = {
                    **DEFAULT_HEADERS,
                    "Content-Type": "application/x-www-form-urlencoded",
                }
                if jar:
                    post_headers["Cookie"] = self._cookie_header(jar)

                r2 = await client.post(
                    SCRAPERAPI_BASE,
                    params={**base_params, "url": self.LOGIN_ENDPOINT},
                    data={"login": email, "password": password, "_csrf_token": csrf},
                    headers=post_headers,
                )
                self._collect_cookies(r2, jar)

                # --- Step 3: Verify session via settings page ---
                verify_headers = {**DEFAULT_HEADERS}
                if jar:
                    verify_headers["Cookie"] = self._cookie_header(jar)

                r3 = await client.get(
                    SCRAPERAPI_BASE,
                    params={**base_params, "url": f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}"},
                    headers=verify_headers,
                )

                if r3.status_code in (301, 302):
                    location = r3.headers.get("location", "")
                    if "login" in location:
                        return AuthResult(success=False, error="Login failed: invalid credentials")
                elif r3.status_code >= 400:
                    # Check body for login redirect indicator
                    html3 = await self._decode(r3)
                    if "login" in html3[:1000].lower() and "settings" not in html3[:500].lower():
                        return AuthResult(success=False, error="Login failed: invalid credentials")

                # --- Step 4: Get user profile ---
                r4 = await client.get(
                    SCRAPERAPI_BASE,
                    params={**base_params, "url": f"{FICBOOK_BASE_URL}/home"},
                    headers=verify_headers,
                )
                self._collect_cookies(r4, jar)
                html4 = await self._decode(r4)
                soup4 = BeautifulSoup(html4, "html.parser")
                user = self._parse_user(soup4)

                return AuthResult(success=True, user=user, cookies=jar)

        except httpx.HTTPError as e:
            return AuthResult(success=False, error=str(e))

    async def _login_direct(self, email: str, password: str) -> AuthResult:
        """Direct login — only works when server IP is not blocked by Cloudflare."""
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

                check = await direct.get(
                    f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}",
                    follow_redirects=False,
                )
                if check.status_code in (301, 302):
                    if "login" in check.headers.get("location", ""):
                        return AuthResult(success=False, error="Login failed: invalid credentials")
                elif check.status_code != 200:
                    return AuthResult(success=False, error="Login failed: invalid credentials")

                home = await direct.get(f"{FICBOOK_BASE_URL}/home")
                user = self._parse_user(BeautifulSoup(home.text, "html.parser"))

                jar = {c.name: c.value for c in direct.cookies.jar}
                for cookie in direct.cookies.jar:
                    self._client.cookies.set(cookie.name, cookie.value, domain=cookie.domain)

                return AuthResult(success=True, user=user, cookies=jar)

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
        # Try multiple selectors for different ficbook.net layouts
        for selector in [
            "a.user-name-avatar",
            "a[href*='/authors/']",
            "a.username",
            ".header-user-name a",
            "nav a[href*=authors]",
        ]:
            user_link = soup.select_one(selector)
            if user_link:
                href = user_link.get("href", "")
                name = user_link.get_text(strip=True)
                user_id = extract_id_from_href(href)
                if user_id:
                    avatar = soup.select_one("img.user-avatar-img, img.user-avatar, .avatar img")
                    avatar_url = avatar.get("src", "") if avatar else None
                    return UserModel(id=user_id, name=name, href=href, avatar_url=avatar_url)
        return None

    @staticmethod
    def _extract_csrf(soup: BeautifulSoup) -> str:
        token = soup.select_one("input[name=_csrf_token]")
        return safe_attr(token, "value") if token else ""
