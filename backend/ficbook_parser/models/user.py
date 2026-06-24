from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


@dataclass
class UserModel:
    id: str = ""
    name: str = ""
    avatar_url: Optional[str] = None
    href: str = ""
