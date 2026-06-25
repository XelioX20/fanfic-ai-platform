from __future__ import annotations
import httpx
import json as _json
import random
from dataclasses import dataclass, field
from typing import Optional
from bs4 import BeautifulSoup
from ..constants import FICBOOK_BASE_URL, ROUTE_SETTINGS
from ..models.user import UserModel
from ..parsers.utils import safe_attr, extract_id_from_href
from ..proxy import proxy_url, is_proxy_available

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

LOGIN_ENDPOINT = f"{FICBOOK_BASE_URL}/login_check"


@dataclass
class AuthResult:
    success: bool
    user: Optional[UserModel] = None
    error: Optional[str] = None
    cookies: dict = field(default_factory=dict)


class FicbookAuth:
    def __init__(self, client: httpx.AsyncClient, scraper_api_key: Optional[str] = None):
        self._client = client

    async def login(self, email: str, password: str) -> AuthResult:
        if is_proxy_available():
            return await self._login_via_proxy(email, password)
        return await self._login_direct(email, password)

    async def _decode(self, resp: httpx.Response) -> str:
        html = resp.content.decode("utf-8", errors="replace")
        try:
            import ftfy
            return ftfy.fix_text(html)
        except ImportError:
            return html

    def _collect_cookies(self, resp: httpx.Response, jar: dict) -> None:
        for name, value in resp.headers.multi_items():
            if name.lower() == "set-cookie":
                part = value.split(";")[0].strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    jar[k.strip()] = v.strip()

    def _cookie_header(self, jar: dict) -> str:
        return "; ".join(f"{k}={v}" for k, v in jar.items())

    async def _login_via_proxy(self, email: str, password: str) -> AuthResult:
        """
        Hybrid login:
        - GET login page via proxy (Cloudflare blocks datacenter GETs)
        - POST login_check DIRECTLY (JSON API, not blocked by Cloudflare)
        - Fetch profile via proxy with collected PHPSESSID cookie
        """
        jar: dict = {}
        try:
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                # Step 1: GET login page via proxy — extract CSRF if present
                login_url = proxy_url(f"{FICBOOK_BASE_URL}/login") or f"{FICBOOK_BASE_URL}/login"
                r1 = await client.get(login_url, headers=DEFAULT_HEADERS)
                self._collect_cookies(r1, jar)
                html1 = await self._decode(r1)
                soup1 = BeautifulSoup(html1, "html.parser")
                csrf = self._extract_csrf(soup1)

                # Step 2: POST login_check DIRECTLY (not through proxy)
                # ficbook's login_check is a JSON API endpoint not blocked by Cloudflare
                post_headers = {
                    **DEFAULT_HEADERS,
                    "Content-Type": "application/x-www-form-urlencoded",
                }
                if jar:
                    post_headers["Cookie"] = self._cookie_header(jar)

                r2 = await client.post(
                    LOGIN_ENDPOINT,
                    data={"login": email, "password": password, "_csrf_token": csrf},
                    headers=post_headers,
                )
                self._collect_cookies(r2, jar)
                html2 = await self._decode(r2)

                # ficbook returns JSON: {"result": true} or {"result": false, "error": {...}}
                try:
                    resp_json = _json.loads(html2)
                    if resp_json.get("result") is False:
                        reason = resp_json.get("error", {}).get("reason", "invalid credentials")
                        return AuthResult(success=False, error=f"Login failed: {reason}")
                except _json.JSONDecodeError:
                    if any(phrase in html2 for phrase in [
                        "Неверный логин", "Invalid login", "user_not_found", "wrong_password"
                    ]):
                        return AuthResult(success=False, error="Login failed: invalid credentials")

                if not jar:
                    return AuthResult(success=False, error="Login failed: no session cookie received")

                # Step 3: Fetch user profile via proxy, forwarding session cookies
                verify_headers = {**DEFAULT_HEADERS, "Cookie": self._cookie_header(jar)}
                home_url = proxy_url(f"{FICBOOK_BASE_URL}/home") or f"{FICBOOK_BASE_URL}/home"
                r3 = await client.get(home_url, headers=verify_headers)
                self._collect_cookies(r3, jar)
                soup3 = BeautifulSoup(await self._decode(r3), "html.parser")
                user = self._parse_user(soup3)

                return AuthResult(success=True, user=user, cookies=jar)

        except httpx.HTTPError as e:
            return AuthResult(success=False, error=str(e))

    async def _login_direct(self, email: str, password: str) -> AuthResult:
        try:
            async with httpx.AsyncClient(headers=DEFAULT_HEADERS, timeout=30.0, follow_redirects=True) as direct:
                resp = await direct.get(f"{FICBOOK_BASE_URL}/login")
                resp.raise_for_status()
                csrf = self._extract_csrf(BeautifulSoup(resp.text, "html.parser"))

                await direct.post(
                    LOGIN_ENDPOINT,
                    data={"login": email, "password": password, "_csrf_token": csrf},
                    follow_redirects=True,
                )

                check = await direct.get(f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}", follow_redirects=False)
                if check.status_code in (301, 302) and "login" in check.headers.get("location", ""):
                    return AuthResult(success=False, error="Login failed: invalid credentials")
                elif check.status_code != 200:
                    return AuthResult(success=False, error="Login failed: invalid credentials")

                home = await direct.get(f"{FICBOOK_BASE_URL}/home")
                user = self._parse_user(BeautifulSoup(home.text, "html.parser"))
                jar = {c.name: c.value for c in direct.cookies.jar}
                return AuthResult(success=True, user=user, cookies=jar)

        except httpx.HTTPError as e:
            return AuthResult(success=False, error=str(e))

    async def check_authorized(self) -> bool:
        try:
            resp = await self._client.get(f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}", follow_redirects=False)
            if resp.status_code in (301, 302):
                return "login" not in resp.headers.get("location", "")
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    def _parse_user(self, soup: BeautifulSoup) -> Optional[UserModel]:
        for selector in ["a.user-name-avatar", "a[href*='/authors/']", "a.username", ".header-user-name a"]:
            user_link = soup.select_one(selector)
            if user_link:
                href = user_link.get("href", "")
                name = user_link.get_text(strip=True)
                user_id = extract_id_from_href(href)
                if user_id:
                    avatar = soup.select_one("img.user-avatar-img, img.user-avatar, .avatar img")
                    return UserModel(id=user_id, name=name, href=href, avatar_url=avatar.get("src") if avatar else None)
        return None

    @staticmethod
    def _extract_csrf(soup: BeautifulSoup) -> str:
        token = soup.select_one("input[name=_csrf_token]")
        return safe_attr(token, "value") if token else ""
