from __future__ import annotations
import re
from bs4 import BeautifulSoup
from ..models.fanfic import ChapterModel
from .utils import safe_text, parse_int


class ChapterParser:
    """Parses chapter content from readfic/{id}/{part_id} page.

    Ficbook's 2026 layout dropped the .part-title / .words-count classes.
    We now look for the semantic markup (`itemprop="headline"`,
    `.part-date`) plus a text-body regex for "N слов" as a last-resort
    fallback. Legacy selectors are kept as first tries so if ficbook
    A/B-tests the old markup back into some regions we still work.
    """

    def parse(self, html: str, chapter_id: str = "") -> ChapterModel:
        soup = BeautifulSoup(html, "html.parser")

        # Title — try modern (itemprop=headline), then legacy classes.
        title_el = (
            soup.select_one("h2[itemprop='headline']")
            or soup.select_one("div.title-area h2")
            or soup.select_one("h2.part-title")
            or soup.select_one("h1.fanfic-main-info")
        )
        title = safe_text(title_el)

        content_div = soup.select_one("div#content")
        text = str(content_div) if content_div else ""

        # Date — modern markup is <div class="part-date" content="YYYY-MM-DD">
        # with a nested <span title="…"> containing the human string.
        date_el = (
            soup.select_one("div.part-date span")
            or soup.select_one("span.part-date span.date")
            or soup.select_one("div.part-date")
        )
        date = safe_text(date_el)

        # Word count. Old markup had a dedicated <span class="words-count">.
        # New markup renders "40 441 слово" inline inside the fic stats;
        # match it with a regex on the visible text. Non-breaking spaces
        # (\xa0) in Russian number formatting are stripped before parse.
        words_count = 0
        words_el = soup.select_one("span.words-count")
        if words_el:
            words_count = parse_int(safe_text(words_el))
        else:
            # Look at the chapter/fic stats block first (small text near top)
            for el in soup.select("div.fanfic-hat-container, section.fanfic-hat, .title-area, body"):
                m = re.search(r"([\d  \s]{1,10})\s*слов", el.get_text(" ", strip=False) if el else "")
                if m:
                    words_count = parse_int(m.group(1).replace(" ", "").replace(" ", "").replace(" ", ""))
                    if words_count:
                        break

        return ChapterModel(
            id=chapter_id,
            title=title,
            date=date,
            words_count=words_count,
            text=text,
        )
