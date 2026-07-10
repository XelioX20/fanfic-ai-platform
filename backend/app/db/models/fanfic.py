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
    # ── LLM enrichment tier (Phase 5.1) ───────────────────────────────
    # Llama 3.3 70B refines the deterministic tag_genre scores and surfaces
    # tropes the author didn't tag. Two extra genres beyond the base seven.
    hurt_comfort_score: Mapped[Optional[float]] = mapped_column(Float)
    dark_score: Mapped[Optional[float]] = mapped_column(Float)
    derived_tags: Mapped[Optional[list]] = mapped_column(JSON)
    llm_mood: Mapped[Optional[str]] = mapped_column(String(64))
    llm_audience: Mapped[Optional[str]] = mapped_column(String(200))
    llm_enriched_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    embedding: Mapped[Optional[list]] = mapped_column(JSON)
    # ── Recommendation enrichment pipeline (Phase 1) ──────────────────
    # The real semantic vector lives in a Postgres-only `embedding_vec
    # halfvec(1024)` column created via raw DDL in session.py (SQLAlchemy
    # + SQLite can't model the pgvector type). These flat columns drive
    # the enrichment state machine and work on both Postgres and SQLite.
    enrichment_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    enrichment_attempts: Mapped[int] = mapped_column(Integer, default=0)
    enrichment_error: Mapped[Optional[str]] = mapped_column(Text)
    embed_text_hash: Mapped[Optional[str]] = mapped_column(String(64))
    embedded_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    analyzed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    user_interactions: Mapped[list["UserFanficInteraction"]] = relationship(
        back_populates="fanfic", lazy="selectin"
    )
