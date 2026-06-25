from __future__ import annotations
import re
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
        soup = BeautifulSoup(html, "html.parser")
        articles = soup.select("article.fanfic-inline, article[class*=fanfic-inline]")
        fanfics = [FanficCardParser().parse(a) for a in articles if a]
        has_next = bool(soup.select_one("li.next:not(.disabled) a, a[rel=next]"))
        return fanfics, has_next


class FanficCardParser:
    """Parses a single fanfic card — updated for ficbook.net 2025+ layout."""

    def parse(self, article: Tag) -> FanficCardModel:
        href = self._parse_href(article)
        fanfic_id = extract_id_from_href(href)
        title = self._parse_title(article)
        author = self._parse_author(article)
        fandoms = self._parse_fandoms(article)
        pairings = self._parse_pairings(article)
        tags = self._parse_tags(article)
        description = self._parse_description(article)
        cover_url = self._parse_cover(article)
        status = self._parse_status(article)
        words_count = self._parse_words_count(article)
        chapters_count = self._parse_chapters_count(article)
        update_date = self._parse_date(article)

        return FanficCardModel(
            href=href,
            id=fanfic_id,
            title=title,
            author=author,
            fandoms=fandoms,
            pairings=pairings,
            tags=tags,
            description=description,
            cover_url=cover_url,
            status=status,
            size=str(words_count),
            update_date=update_date,
        )

    def _parse_href(self, article: Tag) -> str:
        a = article.select_one("h3.fanfic-inline-title a, h2 a[href*=readfic]")
        href = safe_attr(a, "href")
        # Strip premiumVisit and other tracking params
        return href.split("?")[0] if href else ""

    def _parse_title(self, article: Tag) -> str:
        a = article.select_one("h3.fanfic-inline-title a, h2 a[href*=readfic]")
        return safe_text(a)

    def _parse_author(self, article: Tag) -> Optional[UserModel]:
        # New layout: <dl><dt>Автор:</dt><dd><span class="author"><a href="/authors/...">Name</a></span></dd></dl>
        for dl in article.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and "Автор" in safe_text(dt):
                a = dl.select_one("dd a[href*=authors]")
                if a:
                    return UserModel(
                        id=extract_id_from_href(safe_attr(a, "href")),
                        name=safe_text(a),
                        href=safe_attr(a, "href"),
                    )
        # Fallback: old layout
        a = article.select_one("span.author a")
        if a:
            return UserModel(
                id=extract_id_from_href(safe_attr(a, "href")),
                name=safe_text(a),
                href=safe_attr(a, "href"),
            )
        return None

    def _parse_fandoms(self, article: Tag) -> list[str]:
        # New layout: <dl><dt>Фэндом:</dt><dd><a>...</a></dd></dl>
        for dl in article.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and "Фэндом" in safe_text(dt):
                return [a.get_text(strip=True) for a in dl.select("dd a")]
        # Fallback
        return [t.get_text(strip=True) for t in article.select("span.fandom-name")]

    def _parse_pairings(self, article: Tag) -> list[PairingModel]:
        # New layout: <dl><dt>Пэйринг...</dt><dd>...</dd></dl>
        for dl in article.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and ("Пэйринг" in safe_text(dt) or "Персонаж" in safe_text(dt)):
                pairings = []
                for a in dl.select("dd a"):
                    text = a.get_text(strip=True)
                    if "/" in text:
                        chars = [c.strip() for c in text.split("/")]
                        pairings.append(PairingModel(characters=chars))
                    elif text:
                        pairings.append(PairingModel(characters=[text]))
                return pairings
        # Fallback: old layout
        pairing_blocks = article.select("li.pairing-link, a[href*=pairing]")
        pairings = []
        for block in pairing_blocks:
            text = block.get_text(strip=True)
            if "/" in text:
                chars = [c.strip() for c in text.split("/")]
                pairings.append(PairingModel(characters=chars))
        return pairings

    def _parse_tags(self, article: Tag) -> list[FanficTag]:
        tags = []
        # New layout: tags in dl with dt=Метки
        for dl in article.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and "Метки" in safe_text(dt):
                for a in dl.select("dd a"):
                    name = a.get_text(strip=True)
                    is_adult = "adult" in " ".join(a.get("class", [])) or "18" in name
                    tags.append(FanficTag(name=name, is_adult=is_adult))
                return tags
        # Fallback
        for a in article.select("div.tags a, ul.tags li a"):
            name = a.get_text(strip=True)
            is_adult = "adult" in " ".join(a.get("class", [])) or "18" in a.get("href", "")
            tags.append(FanficTag(name=name, is_adult=is_adult))
        return tags

    def _parse_description(self, article: Tag) -> str:
        div = article.select_one("div.fanfic-description, div.description-brief, div.fanfic-short-description")
        if div:
            return safe_text(div)
        # New layout — description might be in a div with specific class
        for div in article.select("div"):
            classes = " ".join(div.get("class", []))
            if "description" in classes.lower():
                text = safe_text(div)
                if text and len(text) > 20:
                    return text
        return ""

    def _parse_cover(self, article: Tag) -> Optional[str]:
        # New layout: <picture class="fanfic-hat-cover-picture"><img src="..."/></picture>
        img = article.select_one("picture.fanfic-hat-cover-picture img, picture img[src*=fanfic-covers]")
        if img:
            src = img.get("src", "")
            return src if src.startswith("http") else absolute_url(src)
        # Fallback
        img = article.select_one("img.fanfic-main-cover, img[class*=cover]")
        if img:
            src = img.get("data-src") or img.get("src", "")
            return absolute_url(src) if src else None
        return None

    def _parse_status(self, article: Tag) -> FanficStatus:
        badges = article.select("div.ds-label, span.ds-label")

        direction = FanficDirection.UNKNOWN
        rating = FanficRating.UNKNOWN
        status = FanficCompletionStatus.UNKNOWN
        is_hot = False

        for badge in badges:
            classes = " ".join(badge.get("class", []))
            text = badge.get_text(strip=True)

            # Direction — new: class contains "direction-"
            if "direction-" in classes:
                # Get text from span.hidden-xs inside, or full text
                span = badge.select_one("span.hidden-xs")
                dir_text = safe_text(span) if span else text
                direction = FanficDirection.get_for_name(dir_text)

            # Rating — class like ds-label-rating-PG-13
            elif "ds-label-rating" in classes:
                rating_match = re.search(r"ds-label-rating-([A-Z0-9\-]+)", classes)
                if rating_match:
                    rating_str = rating_match.group(1).replace("-", "-")
                    rating = FanficRating.get_for_name(rating_str)
                elif text:
                    rating = FanficRating.get_for_name(text)

            # Status — class like ds-label-status-in-progress or ds-label-status-complete
            elif "ds-label-status" in classes:
                status_text = text
                if "in-progress" in classes or "В процессе" in status_text:
                    status = FanficCompletionStatus.IN_PROGRESS
                elif "complete" in classes or "Завершён" in status_text or "Закончен" in status_text:
                    status = FanficCompletionStatus.COMPLETE
                elif "frozen" in classes or "Заморожен" in status_text:
                    status = FanficCompletionStatus.FROZEN

            # Hot
            elif "ds-label-hot" in classes or "hot" in classes:
                is_hot = True

        # Likes — new: span.js-like-count
        likes_el = article.select_one("span.js-like-count")
        likes = parse_int(safe_text(likes_el)) if likes_el else 0

        # Trophies
        trophy_el = article.select_one("span.js-reward-count, span.badge-reward")
        trophies = parse_int(safe_text(trophy_el)) if trophy_el else 0

        return FanficStatus(
            direction=direction, rating=rating, status=status,
            likes=likes, trophies=trophies, is_hot=is_hot,
        )

    def _parse_words_count(self, article: Tag) -> int:
        # New layout: size info in dl
        for dl in article.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and "Размер" in dt.get_text(strip=True):
                dd = dl.select_one("dd")
                if dd:
                    text = dd.get_text(strip=True)
                    match = re.search(r"([\d\s ]+)\s*слов", text)
                    if match:
                        return parse_int(match.group(1))
        # Fallback
        size_el = article.select_one("span.badge-text")
        if size_el:
            text = size_el.get_text(strip=True)
            match = re.search(r"([\d\s ]+)\s*слов", text)
            if match:
                return parse_int(match.group(1))
        return 0

    def _parse_chapters_count(self, article: Tag) -> int:
        for dl in article.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and "Размер" in dt.get_text(strip=True):
                dd = dl.select_one("dd")
                if dd:
                    text = dd.get_text(strip=True)
                    match = re.search(r"(\d+)\s*част", text)
                    if match:
                        return int(match.group(1))
        return 0

    def _parse_date(self, article: Tag) -> str:
        date_el = article.select_one("span.post-date, time[datetime]")
        if date_el:
            return date_el.get("datetime", "") or safe_text(date_el)
        return ""

    def _parse_read_badge(self, article: Tag) -> Optional[ReadBadgeModel]:
        badge = article.select_one("span.read-notification, div.read-date")
        if badge:
            has_update = "unread" in badge.get("class", [])
            return ReadBadgeModel(read_date=safe_text(badge), has_update=has_update)
        return None
