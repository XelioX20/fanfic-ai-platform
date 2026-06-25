from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import re


class FanficDirection(str, Enum):
    GEN = "Джен"
    HET = "Гет"
    SLASH = "Слэш"
    FEMSLASH = "Фемслэш"
    OTHER = "Другое"
    MIXED = "Смешанное"
    UNKNOWN = "Неизвестно"

    @classmethod
    def get_for_name(cls, name: str) -> "FanficDirection":
        name = name.strip()
        for member in cls:
            if member.value == name:
                return member
        # ficbook.net uses "Не определено" for unknown direction
        if "определено" in name.lower() or "unknown" in name.lower():
            return cls.UNKNOWN
        return cls.UNKNOWN


class FanficRating(str, Enum):
    G = "G"
    PG13 = "PG-13"
    R = "R"
    NC17 = "NC-17"
    NC21 = "NC-21"
    UNKNOWN = "Неизвестно"

    @classmethod
    def get_for_name(cls, name: str) -> "FanficRating":
        for member in cls:
            if member.value == name:
                return member
        return cls.UNKNOWN


class FanficCompletionStatus(str, Enum):
    IN_PROGRESS = "В процессе"
    COMPLETE = "Завершён"
    FROZEN = "Заморожен"
    UNKNOWN = "Неизвестно"

    @classmethod
    def get_for_name(cls, name: str) -> "FanficCompletionStatus":
        for member in cls:
            if member.value == name:
                return member
        return cls.UNKNOWN


@dataclass
class FanficTag:
    name: str
    is_adult: bool = False
    href: Optional[str] = None


@dataclass
class FanficStatus:
    direction: FanficDirection = FanficDirection.UNKNOWN
    rating: FanficRating = FanficRating.UNKNOWN
    status: FanficCompletionStatus = FanficCompletionStatus.UNKNOWN
    likes: int = 0
    trophies: int = 0
    is_hot: bool = False


@dataclass
class ReadBadgeModel:
    read_date: str = ""
    has_update: bool = False


@dataclass
class FanficCardModel:
    href: str = ""
    id: str = ""
    title: str = ""
    author: Optional["UserModel"] = None
    original_author: Optional["UserModel"] = None
    fandoms: list[str] = field(default_factory=list)
    pairings: list["PairingModel"] = field(default_factory=list)
    update_date: str = ""
    size: str = ""
    tags: list[FanficTag] = field(default_factory=list)
    description: str = ""
    cover_url: Optional[str] = None
    status: FanficStatus = field(default_factory=FanficStatus)
    read_badge: Optional[ReadBadgeModel] = None


@dataclass
class PairingModel:
    characters: list[str] = field(default_factory=list)
    is_highlight: bool = False

    def __str__(self) -> str:
        return " / ".join(self.characters)


@dataclass
class FanficAuthorModel:
    user: "UserModel"
    role: str = ""


@dataclass
class RewardModel:
    message: str = ""
    from_user: str = ""
    date: str = ""


@dataclass
class FanficChapterSeparate:
    chapters: list["ChapterModel"] = field(default_factory=list)

    @property
    def size(self) -> int:
        return len(self.chapters)


@dataclass
class FanficChapterSingle:
    html_content: str = ""

    @property
    def size(self) -> int:
        return 1


FanficChapter = FanficChapterSeparate | FanficChapterSingle


@dataclass
class ChapterModel:
    id: str = ""
    title: str = ""
    date: str = ""
    words_count: int = 0
    text: str = ""


@dataclass
class FanficPageModel:
    id: str = ""
    name: str = ""
    cover_url: Optional[str] = None
    status: FanficStatus = field(default_factory=FanficStatus)
    rating: FanficRating = FanficRating.UNKNOWN
    direction: FanficDirection = FanficDirection.UNKNOWN
    description: str = ""
    dedication: str = ""
    author_notes: str = ""
    authors: list[FanficAuthorModel] = field(default_factory=list)
    fandoms: list[str] = field(default_factory=list)
    pairings: list[PairingModel] = field(default_factory=list)
    tags: list[FanficTag] = field(default_factory=list)
    chapters: Optional[FanficChapter] = None
    rewards: list[RewardModel] = field(default_factory=list)
    likes: int = 0
    trophies: int = 0
    comments_count: int = 0
    is_liked: bool = False
    is_subscribed: bool = False
    collections_count: int = 0
    pages_count: int = 0


from .user import UserModel  # noqa: E402
