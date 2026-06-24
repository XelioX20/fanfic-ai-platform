"""
Unit tests for ficbook-parser.
Tests use static HTML fixtures — no real network calls.
"""
import pytest
from ficbook_parser.parsers.fanfic_list import FanficListParser, FanficCardParser
from ficbook_parser.parsers.fanfic_page import FanficPageParser
from ficbook_parser.parsers.utils import extract_id_from_href, parse_int
from ficbook_parser.models.fanfic import FanficDirection, FanficRating, FanficCompletionStatus


CARD_HTML = """
<article class="fanfic-inline">
  <h3 class="fanfic-inline-title">
    <a href="/readfic/12345">Тестовый фанфик</a>
  </h3>
  <span class="author"><a href="/authors/67890">Автор Тест</a></span>
  <span class="badge-direction">Джен</span>
  <span class="badge-rating">G</span>
  <span class="badge-status">Завершён</span>
  <span class="badge-like">100</span>
  <div class="fanfic-description">Описание фанфика</div>
  <span class="fandom-name">Тестовый фандом</span>
</article>
"""

LIST_HTML = f"""<html><body>{CARD_HTML}</body></html>"""


def test_extract_id_from_href():
    assert extract_id_from_href("/readfic/12345") == "12345"
    assert extract_id_from_href("/authors/67890") == "67890"
    assert extract_id_from_href("/readfic/12345/part/1") == "1"


def test_parse_int():
    assert parse_int("1 234") == 1234
    assert parse_int("100 лайков") == 100
    assert parse_int("") == 0
    assert parse_int("abc") == 0


def test_fanfic_card_parser():
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(CARD_HTML, "html.parser")
    article = soup.select_one("article")
    card = FanficCardParser().parse(article)
    assert card.id == "12345"
    assert card.title == "Тестовый фанфик"
    assert card.author is not None
    assert card.author.name == "Автор Тест"
    assert card.status.direction == FanficDirection.GEN
    assert card.status.rating == FanficRating.G
    assert card.status.status == FanficCompletionStatus.COMPLETE
    assert card.status.likes == 100
    assert card.description == "Описание фанфика"
    assert "Тестовый фандом" in card.fandoms


def test_fanfic_list_parser():
    fanfics, has_next = FanficListParser().parse(LIST_HTML)
    assert len(fanfics) == 1
    assert fanfics[0].id == "12345"
    assert not has_next
