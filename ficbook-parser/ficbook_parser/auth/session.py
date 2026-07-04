from __future__ import annotations
import httpx
from dataclasses import dataclass
from typing import Optional
from bs4 import BeautifulSoup
from ..constants import FICBOOK_BASE_URL, LOGIN_URL, ROUTE_SETTINGS
from ..models.user import UserModel
from ..parsers.utils import safe_text, safe_attr, extract_id_from_href, absolute_url


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
            encoded = urllib.parse.quote(url)
            return f"/?api_key={self._scraper_api_key}&url={encoded}"
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
        """
        Extract the current logged-in user's id, name and avatar.

        Modern ficbook (2025+) renders the home page as a Vue SPA that
        returns a redirect to /login for unauthenticated requests.  When
        the session is valid the SSR payload still contains the user nav
        block, but the avatar is now inside a Vue component and may not be
        in the raw HTML.

        Strategy:
        1. Fetch /home.  Parse the nav link to get user_id + name.
        2. If we got user_id, fetch /authors/{user_id} — that page is
           always server-rendered and contains the avatar in the
           hat-creator-container block that we already parse for fanfic
           authors.
        3. Fall back to any img with an avatars/ path we can find.
        """
        try:
            resp = await self._client.get(self._wrap(f"{FICBOOK_BASE_URL}/home"))
            soup = BeautifulSoup(resp.text, "html.parser")

            # Try the legacy selector first, then progressively broader ones.
            user_link = (
                soup.select_one("a.user-name-avatar")
                or soup.select_one("a.creator-username")
                or soup.select_one("a[href*='/authors/'][itemprop='author']")
                or soup.select_one("a[href*='/authors/']")
            )
            if not user_link:
                return None

            href = user_link.get("href", "")
            name = user_link.get_text(strip=True)
            user_id = extract_id_from_href(href)
            if not user_id:
                return None

            # Try to find avatar in the current page first.
            avatar_url: Optional[str] = None
            for selector in (
                "img.user-avatar-img",          # old layout
                "div.avatar-cropper img",        # 2025 layout
                "div.hat-creator-container img", # fanfic-author layout
            ):
                img = soup.select_one(selector)
                if img:
                    src = img.get("data-src") or img.get("src") or ""
                    if src and "default_avatar" not in src:
                        avatar_url = absolute_url(src)
                        break

            # If still no custom avatar, fetch /authors/{id} — it always
            # renders the avatar server-side.
            if not avatar_url and user_id:
                try:
                    author_resp = await self._client.get(
                        self._wrap(f"{FICBOOK_BASE_URL}/authors/{user_id}")
                    )
                    author_soup = BeautifulSoup(author_resp.text, "html.parser")
                    for selector in (
                        "div.avatar-cropper img",
                        "div.hat-creator-container img",
                        "div.img-holder-universal img",
                    ):
                        img = author_soup.select_one(selector)
                        if img:
                            src = img.get("data-src") or img.get("src") or ""
                            if src and "default_avatar" not in src:
                                avatar_url = absolute_url(src)
                                break
                    # Even if it's the default, save it — better than None.
                    if not avatar_url:
                        img = author_soup.select_one("div.avatar-cropper img, div.img-holder-universal img")
                        if img:
                            src = img.get("data-src") or img.get("src") or ""
                            if src:
                                avatar_url = absolute_url(src)
                except Exception:
                    pass

            return UserModel(id=user_id, name=name, href=href, avatar_url=avatar_url)
        except Exception:
            pass
        return None

    @staticmethod
    def _extract_csrf(soup: BeautifulSoup) -> str:
        token = soup.select_one("input[name=_csrf_token]")
        return safe_attr(token, "value") if token else ""
