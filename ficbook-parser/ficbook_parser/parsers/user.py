from __future__ import annotations
from bs4 import BeautifulSoup
from ..models.user import UserModel
from .utils import extract_id_from_href, safe_text, safe_attr, absolute_url


class UserParser:
    def parse(self, html: str, user_id: str = "") -> UserModel:
        soup = BeautifulSoup(html, "html.parser")
        name = safe_text(soup.select_one("h1.profile-name, span.username"))
        avatar = soup.select_one("img.profile-avatar, img.user-avatar")
        return UserModel(
            id=user_id,
            name=name,
            avatar_url=absolute_url(safe_attr(avatar, "src")) if avatar else None,
            href=f"/authors/{user_id}",
        )
