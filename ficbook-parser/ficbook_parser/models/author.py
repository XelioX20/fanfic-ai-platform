from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from .user import UserModel
from .fanfic import FanficCardModel


@dataclass
class AuthorProfileModel:
    user: UserModel = None
    bio: str = ""
    fanfics_count: int = 0
    blogs_count: int = 0
    comments_count: int = 0
    followers_count: int = 0
    following_count: int = 0
    fanfics: list[FanficCardModel] = field(default_factory=list)
    is_followed: bool = False


@dataclass
class PopularAuthorModel:
    user: UserModel = None
    position: int = 0
    fanfics_count: int = 0
