from __future__ import annotations
from bs4 import BeautifulSoup, Tag
from ..models.comment import CommentModel, CommentMetadata
from ..models.user import UserModel
from .utils import extract_id_from_href, safe_text, safe_attr, absolute_url, parse_int


class CommentsParser:
    """Parses comments from fanfic page or chapter."""

    def parse(self, html: str) -> list[CommentModel]:
        soup = BeautifulSoup(html, "html.parser")
        return [self._parse_comment(c) for c in soup.select("div.comment-container, li.comment-item")]

    def _parse_comment(self, tag: Tag) -> CommentModel:
        comment_id = tag.get("data-comment-id", "") or tag.get("id", "")
        author_tag = tag.select_one("a.comment-author, a.user-link")
        author = None
        if author_tag:
            avatar = tag.select_one("img.avatar")
            author = UserModel(
                id=extract_id_from_href(safe_attr(author_tag, "href")),
                name=safe_text(author_tag),
                href=safe_attr(author_tag, "href"),
                avatar_url=absolute_url(safe_attr(avatar, "src")) if avatar else None,
            )
        text_tag = tag.select_one("div.comment-text, div.message-text")
        text = text_tag.get_text(separator="\n", strip=True) if text_tag else ""
        date = safe_text(tag.select_one("span.comment-date span.date, time"))
        likes_count = parse_int(safe_text(tag.select_one("span.like-counter")))
        is_liked = tag.select_one("button.like-button.active") is not None
        metadata = CommentMetadata(
            id=comment_id,
            date=date,
            is_liked=is_liked,
            likes_count=likes_count,
        )
        replies = [self._parse_comment(r) for r in tag.select("div.reply-container")]
        return CommentModel(metadata=metadata, author=author, text=text, replies=replies)
