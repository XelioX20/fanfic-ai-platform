import re
from typing import Optional
from bs4 import BeautifulSoup, Tag


NOT_NUMBER_RE = re.compile(r"[^0-9]")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE)


def extract_id_from_href(href: str) -> str:
    """Extract ID from ficbook.net href. Supports both numeric and UUID formats."""
    # Strip query params first
    href_clean = href.split("?")[0].rstrip("/")
    parts = [p for p in href_clean.split("/") if p]
    # Try numeric ID (old format)
    for part in reversed(parts):
        if part.isdigit():
            return part
    # Try UUID (new format: readfic/019d742c-7084-7c16-8977-eb4ca8ea0ae4)
    uuid_match = UUID_RE.search(href_clean)
    if uuid_match:
        return uuid_match.group(0)
    return ""


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
