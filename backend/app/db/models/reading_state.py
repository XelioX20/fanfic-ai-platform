"""
Cross-device reading state — anchors, local history, and bookmarks.

All three models are user-scoped so a user's PC state shows up on their phone.
Anchors are pinpoint positions the user explicitly marked with the ⚓ button;
history is auto-recorded on every fanfic detail page open; bookmarks are
"in favourites" toggled by the heart / bookmark buttons.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, UniqueConstraint, Text
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


class UserBookmark(Base):
    """
    Local 'in favourites' toggle — the heart / bookmark button target.

    Distinct from ficbook.net's own like list, which requires linking a
    ficbook account and issuing AJAX requests to their /ajax/mark endpoint.
    Local bookmarks work for any authenticated user (JWT is enough), sync
    across devices, and populate /profile → Избранное. If the user has
    also linked ficbook we do a best-effort mirror to their ficbook list
    on top; the local record is the source of truth for our UI.
    """

    __tablename__ = "user_bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "fanfic_id", name="uq_user_bookmark_fanfic"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("platform_users.id", ondelete="CASCADE"), index=True)
    fanfic_id: Mapped[str] = mapped_column(String(64), index=True)
    # Denormalised card fields — same shape as UserLocalHistory so the
    # /profile → Избранное tab renders card metadata without a ficbook fetch.
    title: Mapped[str] = mapped_column(String(500))
    author_name: Mapped[Optional[str]] = mapped_column(String(200))
    author_id: Mapped[Optional[str]] = mapped_column(String(50))
    cover_url: Mapped[Optional[str]] = mapped_column(String(500))
    direction: Mapped[Optional[str]] = mapped_column(String(50))
    rating: Mapped[Optional[str]] = mapped_column(String(20))
    completion_status: Mapped[Optional[str]] = mapped_column(String(50))
    fandoms: Mapped[Optional[str]] = mapped_column(Text)  # JSON-encoded list of strings
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)



class UserReadingProgress(Base):
    """Per-chapter scroll depth — the highest-fidelity implicit engagement
    signal. max_progress (0..1) distinguishes "read to the end" from
    "opened & bounced"; visits counts repeat opens. Feeds the taste-vector
    engagement weight (see recommender/taste.py).
    """

    __tablename__ = "user_reading_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "fanfic_id", "chapter_id", name="uq_user_reading_progress"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("platform_users.id", ondelete="CASCADE"), index=True)
    fanfic_id: Mapped[str] = mapped_column(String(64), index=True)
    chapter_id: Mapped[str] = mapped_column(String(64), default="single")
    max_progress: Mapped[float] = mapped_column(Float, default=0.0)  # 0..1, MAX across sessions
    visits: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)
