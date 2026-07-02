from __future__ import annotations
import httpx
import json as _json
from dataclasses import dataclass, field
from typing import Optional
from bs4 import BeautifulSoup
from ..constants import FICBOOK_BASE_URL, LOGIN_CHECK_URL, ROUTE_SETTINGS
from ..models.user import UserModel
from ..parsers.utils import safe_text, safe_attr, extract_id_from_href


@dataclass
class AuthResult:
    success: bool
    user: Optional[UserModel] = None
    error: Optional[str] = None
    cookies: dict = field(default_factory=dict)


class FicbookAuth:
    """
    Cookie-based auth for ficbook.net.
    POST /login_check with login + password — no CSRF token required.
    Stores PHPSESSID and rme cookies.
    """

    def __init__(self, client: httpx.AsyncClient):
        self._client = client

    async def login(self, email: str, password: str) -> AuthResult:
        """
        Login flow from B1ays/ficbook-reader:
        1. POST /login_check with login+password (form-encoded)
        2. Server returns JSON: {"result": true/false, "data": {...}, "error": {...}}
        3. Collect PHPSESSID + rme from Set-Cookie headers
        """
        try:
            import os
            worker_url = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")
            login_url = f"{worker_url}/login_check"

            resp = await self._client.post(
                login_url,
                data={"login": email, "password": password, "remember": "true"},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "authority": "ficbook.net",
                    "origin": "https://ficbook.net",
                    "referer": "https://ficbook.net/",
                },
            )
            resp.raise_for_status()

            try:
                result = resp.json()
            except Exception:
                raw = resp.content.decode("utf-8", errors="replace")
                try:
                    import ftfy
                    raw = ftfy.fix_text(raw)
                except ImportError:
                    pass
                try:
                    result = _json.loads(raw)
                except Exception:
                    return AuthResult(success=False, error="Invalid response from login endpoint")

            if not result.get("result"):
                reason = result.get("error", {}).get("reason", "Invalid credentials") if isinstance(result.get("error"), dict) else str(result.get("error", "Login failed"))
                return AuthResult(success=False, error=f"Login failed: {reason}")

            # Collect PHPSESSID and rme from response
            # Worker forwards Set-Cookie via x-ficbook-set-cookie header
            jar = {}
            set_cookie_header = resp.headers.get("x-ficbook-set-cookie", "") or resp.headers.get("set-cookie", "")
            if set_cookie_header:
                for part in set_cookie_header.split(","):
                    m = __import__("re").match(r"\s*(PHPSESSID|rme)=([^;]+)", part.strip())
                    if m:
                        jar[m.group(1)] = m.group(2)
            # Also check httpx cookie jar
            for cookie in self._client.cookies.jar:
                if cookie.name in ("PHPSESSID", "rme"):
                    jar[cookie.name] = cookie.value

            user = await self._get_current_user()
            return AuthResult(success=True, user=user, cookies=jar)

        except httpx.HTTPError as e:
            return AuthResult(success=False, error=str(e))

    async def check_authorized(self) -> bool:
        """
        Check auth by GETting /home/settings.
        If final URL is ficbook.net/login — not authenticated.
        """
        try:
            resp = await self._client.get(
                f"{FICBOOK_BASE_URL}/{ROUTE_SETTINGS}",
                follow_redirects=True,
            )
            return "ficbook.net/login" not in str(resp.url)
        except httpx.HTTPError:
            return False

    async def _get_current_user(self) -> Optional[UserModel]:
        """Extract user from /home/settings via Worker."""
        try:
            import os
            worker_url = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")
            # Pass cookies we have so far via x-ficbook-cookie header
            cookie_str = "; ".join(f"{k}={v}" for k, v in {
                name: val for name, val in [(c.name, c.value) for c in self._client.cookies.jar]
                if name in ("PHPSESSID", "rme")
            }.items())

            headers = {"User-Agent": "AppleWebKit/605.1"}
            if cookie_str:
                headers["x-ficbook-cookie"] = cookie_str

            resp = await self._client.get(
                f"{worker_url}/home/settings",
                headers=headers,
                follow_redirects=True,
            )
            raw = resp.content.decode("utf-8", errors="replace")
            try:
                import ftfy
                html = ftfy.fix_text(raw)
            except ImportError:
                html = raw

            # Check if redirected to login
            if "ficbook.net/login" in str(resp.url) or 'action="/login_check"' in html:
                return None

            soup = BeautifulSoup(html, "html.parser")
            name_el = soup.select_one("span.text.hidden-xs, span[class='text hidden-xs']")
            avatar_el = soup.select_one(".avatar-cropper img, .avatar-cropper")
            profile_link = soup.select_one(".dropdown.profile-holder li a[href*='/authors/']")

            if not name_el and not profile_link:
                return None

            name = safe_text(name_el) if name_el else ""
            href = safe_attr(profile_link, "href") if profile_link else ""
            user_id = extract_id_from_href(href) if href else ""
            avatar_url = None
            if avatar_el:
                avatar_url = safe_attr(avatar_el, "src") or safe_attr(avatar_el, "data-src")

            return UserModel(id=user_id, name=name, href=href, avatar_url=avatar_url)
        except Exception:
            return None
