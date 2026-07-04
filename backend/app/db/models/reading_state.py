"""
Cross-device reading state — anchors and local history.

Both models are user-scoped so a user's PC anchors show up on their phone.
Anchors are pinpoint positions the user explicitly marked with the ⚓ button;
history is auto-recorded on every fanfic detail page open.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class UserAnchor(Base):
    """One reading anchor per (user, fanfic). Overwritten on re-anchor."""

    __tablename__ = "user_anchors"
    __table_args__ = (UniqueConstraint("user_id", "fanfic_id", name="uq_user_anchor_fanfic"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("platform_users.id", ondelete="CASCADE"), index=True)
    fanfic_id: Mapped[str] = mapped_column(String(64), index=True)
    # 'single' for single-chapter fics; otherwise ficbook chapter UUID / numeric id
    chapter_id: Mapped[str] = mapped_column(String(64))
    scroll_y: Mapped[int] = mapped_column(Integer, default=0)
    # Snapshot for the profile → Продолжить чтение row so we can render the
    # chapter title without a live ficbook round-trip.
    chapter_title: Mapped[Optional[str]] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserLocalHistory(Base):
    """Auto-recorded whenever the user opens /fanfic/{id} on any device."""

    __tablename__ = "user_local_history"
    __table_args__ = (UniqueConstraint("user_id", "fanfic_id", name="uq_user_history_fanfic"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("platform_users.id", ondelete="CASCADE"), index=True)
    fanfic_id: Mapped[str] = mapped_column(String(64), index=True)
    # Denormalised card fields so the history tab renders without hitting ficbook.
    title: Mapped[str] = mapped_column(String(500))
    author_name: Mapped[Optional[str]] = mapped_column(String(200))
    author_id: Mapped[Optional[str]] = mapped_column(String(50))
    cover_url: Mapped[Optional[str]] = mapped_column(String(500))
    direction: Mapped[Optional[str]] = mapped_column(String(50))
    rating: Mapped[Optional[str]] = mapped_column(String(20))
    completion_status: Mapped[Optional[str]] = mapped_column(String(50))
    fandoms: Mapped[Optional[str]] = mapped_column(Text)  # JSON-encoded list of strings
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)
