from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Fanfic(Base):
    __tablename__ = "fanfics"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    author_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    author_id: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    # JSON not ARRAY so the model works against both Postgres (prod) and SQLite
    # (tests). We don't rely on Postgres array-operators anywhere in the codebase.
    fandoms: Mapped[list] = mapped_column(JSON, default=[])
    pairings: Mapped[list] = mapped_column(JSON, default=[])
    tags: Mapped[list] = mapped_column(JSON, default=[])
    direction: Mapped[str] = mapped_column(String(50), default="Неизвестно", index=True)
    rating: Mapped[str] = mapped_column(String(20), default="Неизвестно", index=True)
    completion_status: Mapped[str] = mapped_column(String(50), default="Неизвестно", index=True)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    trophies: Mapped[int] = mapped_column(Integer, default=0)
    words_count: Mapped[int] = mapped_column(Integer, default=0, index=True)
    chapters_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    cover_url: Mapped[Optional[str]] = mapped_column(String(500))
    ficbook_url: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    is_hot: Mapped[bool] = mapped_column(Boolean, default=False)
    romance_score: Mapped[Optional[float]] = mapped_column(Float)
    angst_score: Mapped[Optional[float]] = mapped_column(Float)
    fluff_score: Mapped[Optional[float]] = mapped_column(Float)
    drama_score: Mapped[Optional[float]] = mapped_column(Float)
    humor_score: Mapped[Optional[float]] = mapped_column(Float)
    adventure_score: Mapped[Optional[float]] = mapped_column(Float)
    mystery_score: Mapped[Optional[float]] = mapped_column(Float)
    emotional_intensity: Mapped[Optional[float]] = mapped_column(Float)
    narrative_depth: Mapped[Optional[float]] = mapped_column(Float)
    writing_quality: Mapped[Optional[float]] = mapped_column(Float)
    embedding: Mapped[Optional[list]] = mapped_column(JSON)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    analyzed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    user_interactions: Mapped[list["UserFanficInteraction"]] = relationship(
        back_populates="fanfic", lazy="selectin"
    )
