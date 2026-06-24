from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from .user import UserModel


@dataclass
class CommentMetadata:
    id: str = ""
    fanfic_id: str = ""
    chapter_id: Optional[str] = None
    date: str = ""
    is_liked: bool = False
    likes_count: int = 0


@dataclass
class CommentModel:
    metadata: CommentMetadata = None
    author: Optional[UserModel] = None
    text: str = ""
    replies: list["CommentModel"] = field(default_factory=list)
