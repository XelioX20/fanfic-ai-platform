from __future__ import annotations
from bs4 import BeautifulSoup
from ..models.fanfic import ChapterModel
from .utils import safe_text, parse_int


class ChapterParser:
    """Parses chapter content from readfic/{id}/{part_id} page."""

    def parse(self, html: str, chapter_id: str = "") -> ChapterModel:
        soup = BeautifulSoup(html, "html.parser")
        title = safe_text(soup.select_one("h2.part-title, h1.fanfic-main-info"))
        content_div = soup.select_one("div#content")
        text = str(content_div) if content_div else ""
        date = safe_text(soup.select_one("span.part-date span.date"))
        words_raw = safe_text(soup.select_one("span.words-count"))
        words_count = parse_int(words_raw)
        return ChapterModel(
            id=chapter_id,
            title=title,
            date=date,
            words_count=words_count,
            text=text,
        )
