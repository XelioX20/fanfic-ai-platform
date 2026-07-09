from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class UserTasteVector(Base):
    """Cached per-user taste vector, rebuilt in the background from the
    user's recency- and engagement-weighted reading history.

    The actual `vec halfvec(1024)` column is added Postgres-side via raw
    DDL in session.py (pgvector type can't be modeled through SQLAlchemy
    for the SQLite test path). This ORM row owns the bookkeeping columns;
    reads/writes of `vec` happen through explicit SQL in the recommender
    service.
    """
    __tablename__ = "user_taste_vectors"

    user_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    # facets: list of {centroid:[...], mass:float, top_tags:[...]} for the
    # multi-facet phase; single-mean MVP leaves it null.
    facets: Mapped[Optional[dict]] = mapped_column(JSON)
    n_signals: Mapped[int] = mapped_column(Integer, default=0)
    built_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserRecommendation(Base):
    """Cache-behind serving row. Every /recommendations/for-me read returns
    this payload instantly; a background task refreshes it when stale.
    Guarantees the endpoint is never a hard dependency on the pipeline."""
    __tablename__ = "user_recommendations"

    user_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    # ordered list of {fanfic_id, score, because, anchor_id}
    payload: Mapped[Optional[dict]] = mapped_column(JSON)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    stale_after: Mapped[Optional[datetime]] = mapped_column(DateTime)
