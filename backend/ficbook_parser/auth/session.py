from __future__ import annotations
import httpx
from dataclasses import dataclass
from typing import Optional
from bs4 import BeautifulSoup
from ..constants import FICBOOK_BASE_URL, LOGIN_URL, ROUTE_SETTINGS
from ..models.user import UserModel
from ..parsers.utils import safe_text, safe_attr, extract_id_from_href


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
        try:
            resp = await self._client.get(self._wrap(f"{FICBOOK_BASE_URL}/login"))
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            csrf = self._extract_csrf(soup)

            form_data = {
                "login": email,
                "password": password,
                "_csrf_token": csrf,
            }
            login_url = self._wrap(self.LOGIN_ENDPOINT)
            await self._client.post(login_url, data=form_data, follow_redirects=True)

            is_authed = await self.check_authorized()
            if not is_authed:
                return AuthResult(success=False, error="Login failed: invalid credentials")

            user = await self._get_current_user()
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
            user_link = soup.select_one("a.user-name-avatar, a[href*='/authors/']")
            if user_link:
                href = user_link.get("href", "")
                name = user_link.get_text(strip=True)
                user_id = extract_id_from_href(href)
                avatar = soup.select_one("img.user-avatar-img")
                avatar_url = avatar.get("src", "") if avatar else None
                return UserModel(id=user_id, name=name, href=href, avatar_url=avatar_url)
        except Exception:
            pass
        return None

    @staticmethod
    def _extract_csrf(soup: BeautifulSoup) -> str:
        token = soup.select_one("input[name=_csrf_token]")
        return safe_attr(token, "value") if token else ""
