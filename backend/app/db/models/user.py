from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class UserModel(Base):
    __tablename__ = "platform_users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    ficbook_user_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True)
    ficbook_username: Mapped[Optional[str]] = mapped_column(String(200))
    ficbook_avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    # User-uploaded avatar (base64 data URL or remote URL). Takes precedence
    # over ficbook_avatar_url everywhere — the ficbook one is the fallback.
    custom_avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    ficbook_cookies: Mapped[Optional[dict]] = mapped_column(JSON)
    ficbook_cookies_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    preferences: Mapped[Optional[dict]] = mapped_column(JSON, default={})
    reading_stats: Mapped[Optional[dict]] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime)

    interactions: Mapped[list["UserFanficInteraction"]] = relationship(
        back_populates="user", lazy="selectin"
    )
