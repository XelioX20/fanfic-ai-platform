from __future__ import annotations
import re
from typing import Optional
from bs4 import BeautifulSoup, Tag
from ..models.fanfic import (
    FanficPageModel, FanficChapterSeparate, FanficChapterSingle, ChapterModel,
    FanficAuthorModel, FanficTag, PairingModel, RewardModel, FanficStatus,
    FanficDirection, FanficRating, FanficCompletionStatus,
)
from ..models.user import UserModel
from .utils import extract_id_from_href, parse_int, safe_text, safe_attr, absolute_url


class FanficPageParser:
    """Parses full fanfic page (readfic/{id}) — ports B1ays FanficPageParser.kt."""

    def parse(self, html: str, fanfic_id: str = "") -> FanficPageModel:
        soup = BeautifulSoup(html, "html.parser")

        name = safe_text(soup.select_one("h1.fanfic-main-info"))
        cover_url = self._parse_cover(soup)
        authors = self._parse_authors(soup)
        fandoms = [t.get_text(strip=True) for t in soup.select("span.fandom-name")]
        pairings = self._parse_pairings(soup)
        tags = self._parse_tags(soup)
        description = self._parse_description(soup)
        dedication = safe_text(soup.select_one("div.fanfic-hat-dedication"))
        author_notes = safe_text(soup.select_one("div.author-notes"))

        direction = FanficDirection.get_for_name(safe_text(soup.select_one("span.badge-direction")))
        rating = FanficRating.get_for_name(safe_text(soup.select_one("span.badge-rating")))
        completion = FanficCompletionStatus.get_for_name(safe_text(soup.select_one("span.badge-status")))
        likes = parse_int(safe_text(soup.select_one("span.badge-like")))
        trophies = parse_int(safe_text(soup.select_one("span.badge-reward")))
        is_hot = soup.select_one("span.badge-hot") is not None

        status = FanficStatus(
            direction=direction, rating=rating, status=completion,
            likes=likes, trophies=trophies, is_hot=is_hot,
        )

        chapters = self._parse_chapters(soup)
        rewards = self._parse_rewards(soup)
        comments_count = parse_int(safe_text(soup.select_one("span.comments-count")))
        is_liked = soup.select_one("span.badge-like.active, button.like-button.active") is not None
        is_subscribed = soup.select_one("button.subscribe-button.active") is not None
        collections_count = parse_int(safe_text(soup.select_one("span.collections-count")))
        pages_count = self._parse_pages_count(soup)

        return FanficPageModel(
            id=fanfic_id,
            name=name,
            cover_url=cover_url,
            status=status,
            rating=rating,
            direction=direction,
            description=description,
            dedication=dedication,
            author_notes=author_notes,
            authors=authors,
            fandoms=fandoms,
            pairings=pairings,
            tags=tags,
            chapters=chapters,
            rewards=rewards,
            likes=likes,
            trophies=trophies,
            comments_count=comments_count,
            is_liked=is_liked,
            is_subscribed=is_subscribed,
            collections_count=collections_count,
            pages_count=pages_count,
        )

    def _parse_cover(self, soup: BeautifulSoup) -> Optional[str]:
        img = soup.select_one("img.fanfic-main-cover")
        if img:
            return absolute_url(img.get("data-src") or img.get("src", ""))
        return None

    def _parse_authors(self, soup: BeautifulSoup) -> list[FanficAuthorModel]:
        """Parse author blocks. Each author entry on ficbook is a small card:

            <span class="author">
              <span class="role">Автор:</span>
              <a href="/authors/{id}">
                <img src="…assets.teinon.net/avatars/…" />  ← may be absent
              </a>
              <a href="/authors/{id}">Aurora Grey</a>
            </span>

        Some fics only have a text link (no cover picture) — we tolerate both.
        We pick the FIRST link with a non-empty text content as the canonical
        source of name+href+id, then look sideways for an <img> inside any
        sibling link for the avatar.
        """
        authors: list[FanficAuthorModel] = []
        for span in soup.select("span.author"):
            # Preferred: text-carrying link (skip pure-image wrappers).
            text_link = None
            for a in span.select("a"):
                if a.get_text(strip=True):
                    text_link = a
                    break
            if not text_link:
                # Fall back to any anchor
                text_link = span.select_one("a")
            if not text_link:
                continue

            # Avatar can live inside a sibling <a> that wraps just the <img>,
            # or inside the text link itself. Look across the whole span.
            img = span.select_one("img")
            avatar_url: Optional[str] = None
            if img is not None:
                src = img.get("data-src") or img.get("src") or ""
                if src:
                    avatar_url = absolute_url(src)

            user = UserModel(
                id=extract_id_from_href(safe_attr(text_link, "href")),
                name=text_link.get_text(strip=True),
                href=safe_attr(text_link, "href"),
                avatar_url=avatar_url,
            )
            # Role label is usually the first text node inside the span,
            # rendered as "Автор:" or "Переводчик:" — strip trailing colon.
            role_text = ""
            for node in span.stripped_strings:
                if ":" in node:
                    role_text = node.split(":")[0].strip()
                    break
            role = role_text or "Автор"
            authors.append(FanficAuthorModel(user=user, role=role))
        return authors

    def _parse_pairings(self, soup: BeautifulSoup) -> list[PairingModel]:
        pairings = []
        for a in soup.select("a[href*=pairing], li.pairing-link"):
            text = a.get_text(strip=True)
            if "/" in text:
                chars = [c.strip() for c in text.replace(" / ", "/").split("/")]
                pairings.append(PairingModel(characters=chars))
        return pairings

    def _parse_tags(self, soup: BeautifulSoup) -> list[FanficTag]:
        tags = []
        for a in soup.select("div.tags a, ul.tags li a"):
            tags.append(FanficTag(
                name=a.get_text(strip=True),
                href=a.get("href", ""),
                is_adult="adult" in a.get("class", []),
            ))
        return tags

    def _parse_description(self, soup: BeautifulSoup) -> str:
        div = soup.select_one("div[itemprop=description], div.fanfic-description")
        if div:
            return div.get_text(separator="\n", strip=True)
        return ""

    def _parse_chapters(self, soup: BeautifulSoup) -> Optional[FanficChapterSeparate | FanficChapterSingle]:
        # Single chapter fanfic — content directly in page
        content_div = soup.select_one("div#content")
        if content_div:
            return FanficChapterSingle(html_content=str(content_div))

        # Multi-chapter fanfic
        chapter_items = soup.select("li.chapter-item, div.chapter-row")
        if chapter_items:
            chapters = []
            for item in chapter_items:
                a = item.select_one("a[href*=readfic]")
                if a:
                    chapters.append(ChapterModel(
                        id=extract_id_from_href(safe_attr(a, "href")),
                        title=safe_text(a),
                        date=safe_text(item.select_one("span.date")),
                    ))
            return FanficChapterSeparate(chapters=chapters)

        return None

    def _parse_rewards(self, soup: BeautifulSoup) -> list[RewardModel]:
        rewards = []
        for item in soup.select("div.reward-item, li.reward"):
            rewards.append(RewardModel(
                message=safe_text(item.select_one("span.reward-message")),
                from_user=safe_text(item.select_one("a.user-link")),
                date=safe_text(item.select_one("span.date")),
            ))
        return rewards

    def _parse_pages_count(self, soup: BeautifulSoup) -> int:
        size_span = soup.select_one("span.words-count, span.pages-count")
        return parse_int(safe_text(size_span))
