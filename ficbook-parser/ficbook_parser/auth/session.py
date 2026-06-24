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
    """
    Handles authentication with ficbook.net via session cookies.
    Ports B1ays AuthorizationApi.kt logic.
    POST to login endpoint, verify via settings page redirect check.
    """

    LOGIN_ENDPOINT = f"{FICBOOK_BASE_URL}/login_check"

    def __init__(self, client: httpx.AsyncClient):
        self._client = client

    async def login(self, email: str, password: str) -> AuthResult:
        try:
            # Step 1: GET login page for CSRF token
            resp = await self._client.get(f"{FICBOOK_BASE_URL}/login")
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            csrf = self._extract_csrf(soup)

            # Step 2: POST credentials
            form_data = {
                "login": email,
                "password": password,
                "_csrf_token": csrf,
            }
            login_resp = await self._client.post(
                self.LOGIN_ENDPOINT,
                data=form_data,
                follow_redirects=True,
            )
            # Step 3: Verify authorization by checking settings page
            is_authed = await self.check_authorized()
            if not is_authed:
                return AuthResult(success=False, error="Login failed: invalid credentials")

            # Step 4: Extract user info
            user = await self._get_current_user()
            return AuthResult(success=True, user=user)

        except httpx.HTTPError as e:
            return AuthResult(success=False, error=str(e))

    async def check_authorized(self) -> bool:
        """Verify session is active — ports B1ays isAuthorized() check."""
        try:
            resp = await self._client.get(
                f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}",
                follow_redirects=False,
            )
            # If redirected to login — not authorized
            if resp.status_code in (301, 302):
                location = resp.headers.get("location", "")
                return "login" not in location
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def _get_current_user(self) -> Optional[UserModel]:
        try:
            resp = await self._client.get(f"{FICBOOK_BASE_URL}/home")
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
