from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from .user import UserModel
from .fanfic import FanficCardModel


@dataclass
class CollectionModel:
    id: str = ""
    name: str = ""
    description: str = ""
    owner: Optional[UserModel] = None
    fanfics_count: int = 0
    is_public: bool = True
    fanfics: list[FanficCardModel] = field(default_factory=list)


@dataclass
class AvailableCollectionsModel:
    collections: list[CollectionModel] = field(default_factory=list)
    total: int = 0
