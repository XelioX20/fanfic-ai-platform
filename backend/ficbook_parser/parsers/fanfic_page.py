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
    """Parses full fanfic page (readfic/{id}) — updated for ficbook.net 2025 layout."""

    def parse(self, html: str, fanfic_id: str = "") -> FanficPageModel:
        soup = BeautifulSoup(html, "html.parser")

        name = self._parse_title(soup)
        cover_url = self._parse_cover(soup)
        authors = self._parse_authors(soup)
        fandoms = self._parse_fandoms(soup)
        pairings = self._parse_pairings(soup)
        tags = self._parse_tags(soup)
        description = self._parse_description(soup)
        dedication = (self._parse_meta_text(soup, "Посвящение")
                      or self._parse_block(soup, "посвящение")
                      or safe_text(soup.select_one("div.fanfic-hat-dedication")))
        author_notes = (self._parse_meta_text(soup, "Примечания")
                        or self._parse_meta_text(soup, "От автора")
                        or self._parse_block(soup, "от автора")
                        or safe_text(soup.select_one("div.author-notes")))

        direction, rating, completion, likes, trophies, is_hot = self._parse_status(soup)

        status = FanficStatus(
            direction=direction, rating=rating, status=completion,
            likes=likes, trophies=trophies, is_hot=is_hot,
        )

        chapters = self._parse_chapters(soup, fanfic_id, raw_html=html)
        rewards = self._parse_rewards(soup)
        comments_count = parse_int(safe_text(soup.select_one("span.comments-count, span.js-comments-count")))
        is_liked = soup.select_one("span.badge-like.active, button.like-button.active") is not None
        is_subscribed = soup.select_one("button.subscribe-button.active") is not None
        collections_count = parse_int(safe_text(soup.select_one("span.collections-count")))

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
            pages_count=0,
        )

    def _parse_title(self, soup: BeautifulSoup) -> str:
        # New: h1.heading[itemprop=name] | Old: h1.fanfic-main-info
        el = (soup.select_one("h1[itemprop=name]")
              or soup.select_one("h1.heading")
              or soup.select_one("h1.fanfic-main-info")
              or soup.select_one("h1"))
        return safe_text(el)

    def _parse_cover(self, soup: BeautifulSoup) -> Optional[str]:
        # New layout: picture.fanfic-hat-cover-picture img
        img = (soup.select_one("picture.fanfic-hat-cover-picture img")
               or soup.select_one("img.fanfic-main-cover")
               or soup.select_one("img[src*=fanfic-covers]"))
        if img:
            src = img.get("src") or img.get("data-src", "")
            return src if src.startswith("http") else absolute_url(src)
        return None

    def _parse_authors(self, soup: BeautifulSoup) -> list[FanficAuthorModel]:
        authors = []
        # New 2025 layout: div.hat-creator-container with a.creator-username[itemprop=author]
        for container in soup.select("div.hat-creator-container"):
            a = (container.select_one("a.creator-username[itemprop=author]")
                 or container.select_one("a.creator-username")
                 or container.select_one("a[itemprop=author]"))
            if not a:
                continue
            role_el = container.select_one("div.creator-info i.small-text") or container.select_one("i.small-text")
            role = safe_text(role_el) or "автор"
            user = UserModel(
                id=extract_id_from_href(safe_attr(a, "href")),
                name=safe_text(a),
                href=safe_attr(a, "href"),
            )
            authors.append(FanficAuthorModel(user=user, role=role))
        if authors:
            return authors
        # Old dl.fanfic-inline-info layout
        for dl in soup.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and "Автор" in dt.get_text(strip=True):
                for a in dl.select("dd a[href*=authors]"):
                    user = UserModel(
                        id=extract_id_from_href(safe_attr(a, "href")),
                        name=safe_text(a),
                        href=safe_attr(a, "href"),
                    )
                    authors.append(FanficAuthorModel(user=user, role="Автор"))
        # Fallback old layout
        if not authors:
            for a in soup.select("span.author a"):
                user = UserModel(
                    id=extract_id_from_href(safe_attr(a, "href")),
                    name=safe_text(a),
                    href=safe_attr(a, "href"),
                )
                authors.append(FanficAuthorModel(user=user, role="Автор"))
        return authors

    def _find_meta_block(self, soup: BeautifulSoup, label: str) -> Optional[Tag]:
        """Find a div.mb-10 whose <strong> label matches — new 2025 metadata blocks live in div.description."""
        label_l = label.lower().rstrip(":")
        for block in soup.select("div.description div.mb-10, section.chapter-info div.mb-10, div.mb-10"):
            strong = block.select_one("strong")
            if strong and label_l in strong.get_text(strip=True).lower().rstrip(":"):
                return block
        return None

    def _parse_fandoms(self, soup: BeautifulSoup) -> list[str]:
        # New 2025: div.mb-10 with <strong>Фэндом:</strong> then sibling <div> containing <a>
        block = self._find_meta_block(soup, "Фэндом")
        if block:
            names = [a.get_text(strip=True) for a in block.select("a") if a.get_text(strip=True)]
            if names:
                return names
        # Old dl layout
        for dl in soup.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and "Фэндом" in dt.get_text(strip=True):
                return [a.get_text(strip=True) for a in dl.select("dd a")]
        return [t.get_text(strip=True) for t in soup.select("span.fandom-name")]

    def _parse_pairings(self, soup: BeautifulSoup) -> list[PairingModel]:
        # New 2025: div.mb-10 with <strong>Пэйринги и персонажи:</strong>
        for label in ("Пэйринг", "Персонаж"):
            block = self._find_meta_block(soup, label)
            if block:
                pairings = []
                for a in block.select("a"):
                    text = a.get_text(strip=True)
                    if not text:
                        continue
                    is_highlight = "highlight" in " ".join(a.get("class", []))
                    if "/" in text:
                        chars = [c.strip() for c in text.split("/") if c.strip()]
                        pairings.append(PairingModel(characters=chars, is_highlight=is_highlight))
                    else:
                        pairings.append(PairingModel(characters=[text], is_highlight=is_highlight))
                if pairings:
                    return pairings
        # Old dl layout
        for dl in soup.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and ("Пэйринг" in dt.get_text(strip=True) or "Персонаж" in dt.get_text(strip=True)):
                pairings = []
                for a in dl.select("dd a"):
                    text = a.get_text(strip=True)
                    if "/" in text:
                        chars = [c.strip() for c in text.split("/")]
                        pairings.append(PairingModel(characters=chars))
                    elif text:
                        pairings.append(PairingModel(characters=[text]))
                return pairings
        pairings = []
        for a in soup.select("a[href*=pairing], li.pairing-link"):
            text = a.get_text(strip=True)
            if "/" in text:
                chars = [c.strip() for c in text.replace(" / ", "/").split("/")]
                pairings.append(PairingModel(characters=chars))
        return pairings

    def _parse_tags(self, soup: BeautifulSoup) -> list[FanficTag]:
        # New 2025: div.mb-10 with <strong>Метки:</strong>
        block = self._find_meta_block(soup, "Метки")
        if block:
            tags = []
            for a in block.select("a"):
                name = a.get_text(strip=True)
                if not name:
                    continue
                classes = " ".join(a.get("class", []))
                is_adult = "adult" in classes or "18" in name
                tags.append(FanficTag(name=name, href=a.get("href", ""), is_adult=is_adult))
            if tags:
                return tags
        # Old dl layout
        for dl in soup.select("dl.fanfic-inline-info"):
            dt = dl.select_one("dt")
            if dt and "Метки" in dt.get_text(strip=True):
                tags = []
                for a in dl.select("dd a"):
                    name = a.get_text(strip=True)
                    is_adult = "adult" in " ".join(a.get("class", [])) or "18" in name
                    tags.append(FanficTag(name=name, is_adult=is_adult))
                return tags
        tags = []
        for a in soup.select("div.tags a, ul.tags li a"):
            tags.append(FanficTag(
                name=a.get_text(strip=True),
                href=a.get("href", ""),
                is_adult="adult" in " ".join(a.get("class", [])),
            ))
        return tags

    def _parse_description(self, soup: BeautifulSoup) -> str:
        # New 2025: div.mb-10 with <strong>Описание:</strong>
        block = self._find_meta_block(soup, "Описание")
        if block:
            # Prefer the sibling <div> after <strong>
            inner = block.find("div")
            target = inner if inner else block
            text = target.get_text(separator="\n", strip=True)
            if text:
                # Strip the leading "Описание:" if it was included
                if text.lower().startswith("описание"):
                    text = text.split(":", 1)[-1].strip()
                return text
        div = (soup.select_one("div[itemprop=description]")
               or soup.select_one("div.fanfic-description"))
        if div:
            return div.get_text(separator="\n", strip=True)
        return ""

    def _parse_meta_text(self, soup: BeautifulSoup, label: str) -> str:
        """Extract text content of a div.mb-10 metadata block by <strong> label."""
        block = self._find_meta_block(soup, label)
        if not block:
            return ""
        inner = block.find("div")
        target = inner if inner else block
        text = target.get_text(separator="\n", strip=True)
        # Strip leading label prefix if it was included
        label_clean = label.rstrip(":").lower()
        if text.lower().startswith(label_clean):
            text = text.split(":", 1)[-1].strip() if ":" in text else text[len(label_clean):].strip()
        return text

    def _parse_block(self, soup: BeautifulSoup, keyword: str) -> str:
        """Find a section by keyword in its heading."""
        for el in soup.find_all(["div", "section"]):
            heading = el.find(["h2", "h3", "h4", "dt"])
            if heading and keyword.lower() in heading.get_text(strip=True).lower():
                return el.get_text(separator="\n", strip=True)
        return ""

    def _parse_status(self, soup: BeautifulSoup):
        direction = FanficDirection.UNKNOWN
        rating = FanficRating.UNKNOWN
        completion = FanficCompletionStatus.UNKNOWN
        is_hot = False

        for badge in soup.select("div.ds-label, span.ds-label"):
            classes = " ".join(badge.get("class", []))
            text = badge.get_text(strip=True)

            if "direction-" in classes:
                span = badge.select_one("span.hidden-xs")
                dir_text = safe_text(span) if span else text
                direction = FanficDirection.get_for_name(dir_text)

            elif "ds-label-rating" in classes:
                m = re.search(r"ds-label-rating-([A-Z0-9\-]+)", classes)
                if m:
                    rating = FanficRating.get_for_name(m.group(1))
                elif text:
                    rating = FanficRating.get_for_name(text)

            elif "ds-label-status" in classes:
                if "in-progress" in classes or "В процессе" in text:
                    completion = FanficCompletionStatus.IN_PROGRESS
                elif "finished" in classes or "complete" in classes or "Завершён" in text or "Закончен" in text:
                    completion = FanficCompletionStatus.COMPLETE
                elif "frozen" in classes or "Заморожен" in text:
                    completion = FanficCompletionStatus.FROZEN

            elif "ds-label-hot" in classes or "hot" in classes:
                is_hot = True

        # Fallback old selectors
        if direction == FanficDirection.UNKNOWN:
            direction = FanficDirection.get_for_name(safe_text(soup.select_one("span.badge-direction")))
        if rating == FanficRating.UNKNOWN:
            rating = FanficRating.get_for_name(safe_text(soup.select_one("span.badge-rating")))
        if completion == FanficCompletionStatus.UNKNOWN:
            completion = FanficCompletionStatus.get_for_name(safe_text(soup.select_one("span.badge-status")))

        likes_el = (soup.select_one("section.fanfic-badges span.js-marks-plus")
                    or soup.select_one("span.js-marks-plus")
                    or soup.select_one("span.js-like-count")
                    or soup.select_one("span.badge-like"))
        likes = parse_int(safe_text(likes_el))

        # Trophies: 2025 layout — div.ds-label-regular whose SVG uses ic_trophy,
        # counter is a bare text node next to the SVG (not inside a span).
        trophies = 0
        for badge in soup.select("section.fanfic-badges div.ds-label-regular, div.ds-label-regular"):
            svg = badge.select_one("svg")
            classes = " ".join(svg.get("class", [])) if svg else ""
            use_href = ""
            use_el = badge.select_one("use")
            if use_el:
                use_href = use_el.get("href", "") or use_el.get("xlink:href", "")
            if "ic_trophy" in classes or "ic_trophy" in use_href:
                # Collect direct text (excluding svg content)
                parts = [t for t in badge.find_all(string=True, recursive=True)
                         if t.parent.name != "use"]
                text_val = " ".join(s.strip() for s in parts if s.strip())
                trophies = parse_int(text_val)
                break
        if trophies == 0:
            trophies_el = (soup.select_one("span.js-reward-count")
                           or soup.select_one("span.badge-reward"))
            trophies = parse_int(safe_text(trophies_el))

        return direction, rating, completion, likes, trophies, is_hot

    def _parse_chapters(self, soup: BeautifulSoup, fanfic_id: str, raw_html: str = "") -> Optional[FanficChapterSeparate | FanficChapterSingle]:
        # 1. Try to extract chapter list from embedded JSON in <script> tags
        # ficbook.net embeds chapter data as window.__initial_state__ or similar
        import json as _json
        for script in soup.find_all("script"):
            text = script.string or ""
            # Look for parts/chapters array in JS state
            for pattern in [
                r'"parts"\s*:\s*(\[.*?\])',
                r'"chapters"\s*:\s*(\[.*?\])',
                r'window\.__CHAPTERS__\s*=\s*(\[.*?\])',
            ]:
                m = re.search(pattern, text, re.DOTALL)
                if m:
                    try:
                        parts = _json.loads(m.group(1))
                        if parts and isinstance(parts, list):
                            chapters = []
                            for p in parts:
                                if isinstance(p, dict):
                                    pid = str(p.get("id", "") or p.get("part_id", ""))
                                    title = p.get("title", "") or p.get("name", "") or f"Глава {len(chapters)+1}"
                                    date = p.get("date", "") or p.get("created_at", "")
                                    words = int(p.get("words_count", 0) or 0)
                                    if pid:
                                        chapters.append(ChapterModel(id=pid, title=title, date=str(date), words_count=words))
                            if len(chapters) > 1:
                                return FanficChapterSeparate(chapters=chapters)
                    except Exception:
                        pass

        # 2. Old layout multi-chapter list
        chapter_items = soup.select("li.chapter-item, div.chapter-row")
        if chapter_items:
            chapters = []
            for item in chapter_items:
                a = item.select_one("a[href*=readfic]")
                if a:
                    chapters.append(ChapterModel(
                        id=extract_id_from_href(safe_attr(a, "href")),
                        title=safe_text(a),
                        date=safe_text(item.select_one("span.date, time")),
                    ))
            if chapters:
                return FanficChapterSeparate(chapters=chapters)

        # 3. New layout: iterate all <a> tags, find numeric part IDs
        NON_CHAPTER_TEXT = {"тзыв", "Начать", "Скачать", "скачать"}
        part_links = []
        seen: set = set()

        for a in soup.find_all("a", href=True):
            href = a["href"]
            # Must contain fanfic_id followed by a slash and numeric ID
            if fanfic_id not in href:
                continue
            after = href.split(fanfic_id + "/")[-1]
            # Strip anchor
            part_id = after.split("#")[0].split("?")[0].strip("/")
            if not part_id or not part_id.isdigit():
                continue
            if part_id in seen:
                continue
            link_text = a.get_text(strip=True)
            if any(skip in link_text for skip in NON_CHAPTER_TEXT):
                continue
            seen.add(part_id)
            part_links.append(ChapterModel(
                id=part_id,
                title=link_text or f"Часть {len(part_links)+1}",
                date="",
            ))

        if len(part_links) > 1:
            return FanficChapterSeparate(chapters=part_links)

        # 4. Single-chapter: content directly in page
        content_div = soup.select_one("div#content, [itemprop=articleBody]")
        if content_div:
            return FanficChapterSingle(html_content=str(content_div))

        if part_links:
            return FanficChapterSeparate(chapters=part_links)

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
