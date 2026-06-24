from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class FanficBase(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    author_name: str
    author_id: Optional[str] = None
    fandoms: list[str] = []
    pairings: list[dict] = []
    tags: list[dict] = []
    direction: str = "Неизвестно"
    rating: str = "Неизвестно"
    completion_status: str = "Неизвестно"
    likes: int = 0
    trophies: int = 0
    words_count: int = 0
    chapters_count: int = 0
    comments_count: int = 0
    cover_url: Optional[str] = None
    ficbook_url: str
    is_hot: bool = False


class FanficAIScores(BaseModel):
    romance_score: Optional[float] = None
    angst_score: Optional[float] = None
    fluff_score: Optional[float] = None
    drama_score: Optional[float] = None
    humor_score: Optional[float] = None
    adventure_score: Optional[float] = None
    mystery_score: Optional[float] = None
    emotional_intensity: Optional[float] = None
    narrative_depth: Optional[float] = None
    writing_quality: Optional[float] = None


class FanficRead(FanficBase):
    ai_scores: Optional[FanficAIScores] = None
    published_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    scraped_at: Optional[datetime] = None
    analyzed_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class FanficListResponse(BaseModel):
    items: list[FanficRead]
    total: int
    page: int
    page_size: int
    has_next: bool


class FanficFilter(BaseModel):
    direction: Optional[str] = None
    rating: Optional[str] = None
    completion_status: Optional[str] = None
    fandom: Optional[str] = None
    min_words: Optional[int] = None
    max_words: Optional[int] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
