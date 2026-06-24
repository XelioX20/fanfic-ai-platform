from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class UserFanficInteraction(Base):
    __tablename__ = "user_fanfic_interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("platform_users.id"), index=True)
    fanfic_id: Mapped[str] = mapped_column(String(50), ForeignKey("fanfics.id"), index=True)
    interaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    rating: Mapped[Optional[float]] = mapped_column(Float)
    reading_progress: Mapped[Optional[float]] = mapped_column(Float)
    reading_time_seconds: Mapped[int] = mapped_column(Integer, default=0)
    chapter_id: Mapped[Optional[str]] = mapped_column(String(50))
    is_bookmarked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_liked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_finished: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["UserModel"] = relationship(back_populates="interactions")
    fanfic: Mapped["Fanfic"] = relationship(back_populates="user_interactions")
