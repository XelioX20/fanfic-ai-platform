from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class FandomModel:
    id: str = ""
    name: str = ""
    href: str = ""
    fanfics_count: int = 0


@dataclass
class CharacterModel:
    id: str = ""
    name: str = ""
    fandom_id: str = ""


@dataclass
class TagSearchResult:
    id: str = ""
    name: str = ""
    fanfics_count: int = 0
    is_adult: bool = False


@dataclass
class SearchModels:
    fandoms: list[FandomModel] = field(default_factory=list)
    characters: list[CharacterModel] = field(default_factory=list)
    tags: list[TagSearchResult] = field(default_factory=list)
