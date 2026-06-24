from __future__ import annotations
from bs4 import BeautifulSoup
from ..models.author import AuthorProfileModel
from ..models.user import UserModel
from .fanfic_list import FanficListParser
from .utils import extract_id_from_href, safe_text, safe_attr, absolute_url, parse_int


class AuthorProfileParser:
    """Parses author profile page (authors/{id})."""

    def parse(self, html: str, author_id: str = "") -> AuthorProfileModel:
        soup = BeautifulSoup(html, "html.parser")
        name_tag = soup.select_one("h1.profile-name, h2.profile-name")
        avatar = soup.select_one("img.profile-avatar, img.user-avatar")
        user = UserModel(
            id=author_id,
            name=safe_text(name_tag),
            avatar_url=absolute_url(safe_attr(avatar, "src")) if avatar else None,
            href=f"/authors/{author_id}",
        )
        bio = safe_text(soup.select_one("div.profile-bio, div.user-bio"))
        fanfics_count = parse_int(safe_text(soup.select_one("span.fanfics-count")))
        followers_count = parse_int(safe_text(soup.select_one("span.followers-count")))
        following_count = parse_int(safe_text(soup.select_one("span.following-count")))
        fanfics, _ = FanficListParser().parse(html)
        return AuthorProfileModel(
            user=user,
            bio=bio,
            fanfics_count=fanfics_count,
            followers_count=followers_count,
            following_count=following_count,
            fanfics=fanfics,
        )
