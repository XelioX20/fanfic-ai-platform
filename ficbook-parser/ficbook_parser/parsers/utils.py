import re
from typing import Optional
from bs4 import BeautifulSoup, Tag


NOT_NUMBER_RE = re.compile(r"[^0-9]")


def extract_id_from_href(href: str) -> str:
    """Extract numeric ID from ficbook.net href."""
    parts = [p for p in href.rstrip("/").split("/") if p]
    for part in reversed(parts):
        if part.isdigit():
            return part
    match = re.search(r"/(d+)", href)
    return match.group(1) if match else ""


def parse_int(text: str, default: int = 0) -> int:
    """Parse integer from text, stripping non-numeric chars."""
    cleaned = NOT_NUMBER_RE.sub("", text.strip())
    return int(cleaned) if cleaned else default


def safe_text(tag: Optional[Tag], default: str = "") -> str:
    if tag is None:
        return default
    return tag.get_text(strip=True)


def safe_attr(tag: Optional[Tag], attr: str, default: str = "") -> str:
    if tag is None:
        return default
    return tag.get(attr, default) or default


def absolute_url(path: str, base: str = "https://ficbook.net") -> str:
    if not path:
        return ""
    if path.startswith("http"):
        return path
    return f"{base}{path if path.startswith('/') else '/' + path}"
