from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class NotificationType(str, Enum):
    NEW_CHAPTER = "new_chapter"
    NEW_COMMENT = "new_comment"
    NEW_REPLY = "new_reply"
    NEW_FOLLOWER = "new_follower"
    REWARD = "reward"
    UNKNOWN = "unknown"


@dataclass
class NotificationModel:
    id: str = ""
    type: NotificationType = NotificationType.UNKNOWN
    title: str = ""
    text: str = ""
    href: Optional[str] = None
    date: str = ""
    is_read: bool = False
