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
        """Parse author blocks.

        Modern ficbook renders each author as a hat-creator card:

            <div class="hat-creator-container">
              <div class="avatar-decoration-holder">
                <div class="img-holder-universal avatar-40">
                  <div class="avatar-cropper">
                    <a href="/authors/{id}">
                      <img src="…assets.teinon.net/avatars/…" />
                    </a>
                  </div>
                </div>
              </div>
              <div class="creator-info">
                <a href="/authors/{id}" class="creator-username">Aurora Grey</a>
                <i class="small-text text-muted">переводчик</i>
              </div>
            </div>

        The old markup used <span class="author"><a>…</a></span> which is
        gone as of 2025+. We also fall back to that legacy selector so we
        keep working if ficbook flip-flops the layout.
        """
        authors: list[FanficAuthorModel] = []

        # Primary: modern hat-creator-container cards
        cards = soup.select("div.hat-creator-container")
        # Fallback: legacy span.author
        if not cards:
            cards = soup.select("span.author")

        for card in cards:
            # Name comes from the first anchor with text content
            name_link = card.select_one("a.creator-username") or next(
                (a for a in card.select("a") if a.get_text(strip=True)),
                None,
            )
            if not name_link:
                continue

            # Avatar image anywhere inside the card
            img = card.select_one("img")
            avatar_url: Optional[str] = None
            if img is not None:
                src = img.get("data-src") or img.get("src") or ""
                if src:
                    avatar_url = absolute_url(src)

            # Role: modern layout uses <i class="small-text text-muted">переводчик</i>
            role_el = card.select_one("i.small-text, i.text-muted, span.role")
            if role_el:
                role_text = role_el.get_text(strip=True).rstrip(":").strip()
            else:
                # Legacy: first line with ':' inside the block
                role_text = ""
                for node in card.stripped_strings:
                    if ":" in node:
                        role_text = node.split(":")[0].strip()
                        break
            role = role_text or "Автор"

            user = UserModel(
                id=extract_id_from_href(safe_attr(name_link, "href")),
                name=name_link.get_text(strip=True),
                href=safe_attr(name_link, "href"),
                avatar_url=avatar_url,
            )
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
