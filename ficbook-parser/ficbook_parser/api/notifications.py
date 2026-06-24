from __future__ import annotations
import httpx
from bs4 import BeautifulSoup
from ..constants import FICBOOK_BASE_URL, ROUTE_NOTIFICATIONS
from ..models.notification import NotificationModel, NotificationType
from ..parsers.utils import safe_text, safe_attr, extract_id_from_href


class NotificationsApi:
    def __init__(self, client: httpx.AsyncClient):
        self._client = client

    async def get(self, page: int = 1) -> list[NotificationModel]:
        url = f"{FICBOOK_BASE_URL}/{ROUTE_NOTIFICATIONS}?p={page}"
        resp = await self._client.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for item in soup.select("li.notification-item, div.notification-row"):
            notif_id = item.get("data-id", "")
            title = safe_text(item.select_one("span.notification-title"))
            text = safe_text(item.select_one("span.notification-text"))
            href_tag = item.select_one("a[href]")
            href = safe_attr(href_tag, "href")
            date = safe_text(item.select_one("span.date"))
            is_read = "read" in item.get("class", [])
            type_class = " ".join(item.get("class", []))
            ntype = NotificationType.UNKNOWN
            if "chapter" in type_class:
                ntype = NotificationType.NEW_CHAPTER
            elif "comment" in type_class:
                ntype = NotificationType.NEW_COMMENT
            elif "follower" in type_class:
                ntype = NotificationType.NEW_FOLLOWER
            results.append(NotificationModel(
                id=notif_id, type=ntype, title=title,
                text=text, href=href, date=date, is_read=is_read,
            ))
        return results
