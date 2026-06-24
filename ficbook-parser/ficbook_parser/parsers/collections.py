from __future__ import annotations
from bs4 import BeautifulSoup, Tag
from ..models.collection import CollectionModel
from ..models.user import UserModel
from .utils import extract_id_from_href, safe_text, safe_attr, parse_int


class CollectionsParser:
    """Parses collections pages."""

    def parse_list(self, html: str) -> list[CollectionModel]:
        soup = BeautifulSoup(html, "html.parser")
        return [self._parse_card(c) for c in soup.select("div.collection-card, li.collection-item")]

    def _parse_card(self, tag: Tag) -> CollectionModel:
        a = tag.select_one("a.collection-name, h3 a")
        coll_id = extract_id_from_href(safe_attr(a, "href"))
        name = safe_text(a)
        desc = safe_text(tag.select_one("div.collection-description"))
        count = parse_int(safe_text(tag.select_one("span.fanfics-count")))
        owner_a = tag.select_one("a.collection-owner, span.owner a")
        owner = None
        if owner_a:
            owner = UserModel(
                id=extract_id_from_href(safe_attr(owner_a, "href")),
                name=safe_text(owner_a),
                href=safe_attr(owner_a, "href"),
            )
        is_public = tag.select_one("span.private-badge") is None
        return CollectionModel(
            id=coll_id,
            name=name,
            description=desc,
            owner=owner,
            fanfics_count=count,
            is_public=is_public,
        )
