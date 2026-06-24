from __future__ import annotations
from typing import Optional
from bs4 import BeautifulSoup, Tag
from ..models.fanfic import (
    FanficCardModel, FanficStatus, FanficTag, ReadBadgeModel, PairingModel,
    FanficDirection, FanficRating, FanficCompletionStatus,
)
from ..models.user import UserModel
from .utils import extract_id_from_href, parse_int, safe_text, safe_attr, absolute_url


class FanficListParser:
    """Parses the list of fanfic cards from a search/section page."""

    def parse(self, html: str) -> tuple[list[FanficCardModel], bool]:
        """Returns (fanfics, has_next_page)."""
        soup = BeautifulSoup(html, "html.parser")
        articles = soup.select("article[class*=fanfic-inline]")
        fanfics = [FanficCardParser().parse(a) for a in articles if a]
        has_next = soup.select_one("li.next:not(.disabled) a") is not None
        return fanfics, has_next


class FanficCardParser:
    """Parses a single fanfic card article element."""

    def parse(self, article: Tag) -> FanficCardModel:
        href = self._parse_href(article)
        fanfic_id = extract_id_from_href(href)
        title = self._parse_title(article)
        author, original_author = self._parse_authors(article)
        fandoms = self._parse_fandoms(article)
        pairings = self._parse_pairings(article)
        tags = self._parse_tags(article)
        description = self._parse_description(article)
        cover_url = self._parse_cover(article)
        status = self._parse_status(article)
        size = safe_text(article.select_one("span.badge-text"))
        update_date = safe_text(article.select_one("span.post-date"))
        read_badge = self._parse_read_badge(article)

        return FanficCardModel(
            href=href,
            id=fanfic_id,
            title=title,
            author=author,
            original_author=original_author,
            fandoms=fandoms,
            pairings=pairings,
            tags=tags,
            description=description,
            cover_url=cover_url,
            status=status,
            size=size,
            update_date=update_date,
            read_badge=read_badge,
        )

    def _parse_href(self, article: Tag) -> str:
        a = article.select_one("h3.fanfic-inline-title a, h2 a[href*=readfic]")
        return safe_attr(a, "href")

    def _parse_title(self, article: Tag) -> str:
        a = article.select_one("h3.fanfic-inline-title a, h2 a[href*=readfic]")
        return safe_text(a)

    def _parse_authors(self, article: Tag) -> tuple[Optional[UserModel], Optional[UserModel]]:
        authors = article.select("span.author a")
        author = None
        original_author = None
        if authors:
            a = authors[0]
            author = UserModel(
                id=extract_id_from_href(safe_attr(a, "href")),
                name=safe_text(a),
                href=safe_attr(a, "href"),
            )
        if len(authors) > 1:
            a = authors[1]
            original_author = UserModel(
                id=extract_id_from_href(safe_attr(a, "href")),
                name=safe_text(a),
                href=safe_attr(a, "href"),
            )
        return author, original_author

    def _parse_fandoms(self, article: Tag) -> list[str]:
        fandom_block = article.find(lambda t: t.name == "span" and "Фэндом:" in t.get_text())
        if fandom_block:
            return [a.get_text(strip=True) for a in fandom_block.find_next_siblings("a")]
        return [t.get_text(strip=True) for t in article.select("span.fandom-name")]

    def _parse_pairings(self, article: Tag) -> list[PairingModel]:
        pairing_blocks = article.select("li.pairing-link, a[href*=pairing]")
        pairings = []
        for block in pairing_blocks:
            text = block.get_text(strip=True)
            if " / " in text or "/" in text:
                chars = [c.strip() for c in text.replace(" / ", "/").split("/")]
                is_highlight = "highlight" in block.get("class", [])
                pairings.append(PairingModel(characters=chars, is_highlight=is_highlight))
        return pairings

    def _parse_tags(self, article: Tag) -> list[FanficTag]:
        tags = []
        for a in article.select("div.tags a, ul.tags li a"):
            name = a.get_text(strip=True)
            href = a.get("href", "")
            is_adult = "adult" in a.get("class", []) or "18" in href
            tags.append(FanficTag(name=name, is_adult=is_adult, href=href))
        return tags

    def _parse_description(self, article: Tag) -> str:
        div = article.select_one("div.fanfic-description, div.description-brief")
        return safe_text(div)

    def _parse_cover(self, article: Tag) -> Optional[str]:
        img = article.select_one("img.fanfic-main-cover, img[class*=cover]")
        if img:
            src = img.get("data-src") or img.get("src", "")
            return absolute_url(src) if src else None
        return None

    def _parse_status(self, article: Tag) -> FanficStatus:
        direction = FanficDirection.get_for_name(
            safe_text(article.select_one("span.badge-direction"))
        )
        rating = FanficRating.get_for_name(
            safe_text(article.select_one("span.badge-rating"))
        )
        status = FanficCompletionStatus.get_for_name(
            safe_text(article.select_one("span.badge-status"))
        )
        likes = parse_int(safe_text(article.select_one("span.badge-like")))
        trophies = parse_int(safe_text(article.select_one("span.badge-reward")))
        is_hot = article.select_one("span.badge-hot") is not None
        return FanficStatus(
            direction=direction, rating=rating, status=status,
            likes=likes, trophies=trophies, is_hot=is_hot,
        )

    def _parse_read_badge(self, article: Tag) -> Optional[ReadBadgeModel]:
        badge = article.select_one("span.read-notification, div.read-date")
        if badge:
            has_update = "unread" in badge.get("class", [])
            return ReadBadgeModel(read_date=safe_text(badge), has_update=has_update)
        return None
