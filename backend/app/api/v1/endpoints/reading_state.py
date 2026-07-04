"""
Reading-state endpoints — anchors and local history, both user-scoped and
cross-device.

  GET  /profile/anchors                       → list of ReadingAnchor rows
  PUT  /profile/anchors/{fanfic_id}           → upsert an anchor (one per fic)
  DELETE /profile/anchors/{fanfic_id}         → drop the anchor

  GET  /profile/local-history                 → recent openings
  PUT  /profile/local-history/{fanfic_id}     → record/refresh an open
  DELETE /profile/local-history/{fanfic_id}   → drop a single entry
  DELETE /profile/local-history                → clear all

All routes require our JWT. The client Zustand store still holds the same
data locally so the UI is instant; a small hydrator syncs from the server
after auth and pushes every mutation.
"""
from __future__ import annotations
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_token
from app.db.session import AsyncSessionLocal
from app.db.models.reading_state import UserAnchor, UserLocalHistory

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)


async def _get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


async def _get_db():
    async with AsyncSessionLocal() as db:
        yield db


# ─── Anchors ────────────────────────────────────────────────────────────

class AnchorPayload(BaseModel):
    chapter_id: str = Field(min_length=1)
    scroll_y: int = Field(ge=0, default=0)
    chapter_title: Optional[str] = None


class AnchorRead(BaseModel):
    fanfic_id: str
    chapter_id: str
    scroll_y: int
    chapter_title: Optional[str] = None
    updated_at: datetime


@router.get("/anchors", response_model=list[AnchorRead])
async def list_anchors(user_id: str = Depends(_get_current_user_id)):
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(UserAnchor).where(UserAnchor.user_id == user_id).order_by(UserAnchor.updated_at.desc())
            )
        ).scalars().all()
        return [
            AnchorRead(
                fanfic_id=r.fanfic_id,
                chapter_id=r.chapter_id,
                scroll_y=r.scroll_y,
                chapter_title=r.chapter_title,
                updated_at=r.updated_at,
            )
            for r in rows
        ]


@router.put("/anchors/{fanfic_id}", response_model=AnchorRead)
async def upsert_anchor(
    fanfic_id: str,
    payload: AnchorPayload,
    user_id: str = Depends(_get_current_user_id),
):
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                select(UserAnchor).where(
                    UserAnchor.user_id == user_id,
                    UserAnchor.fanfic_id == fanfic_id,
                )
            )
        ).scalar_one_or_none()
        if row is None:
            row = UserAnchor(
                user_id=user_id,
                fanfic_id=fanfic_id,
                chapter_id=payload.chapter_id,
                scroll_y=payload.scroll_y,
                chapter_title=payload.chapter_title,
            )
            db.add(row)
        else:
            row.chapter_id = payload.chapter_id
            row.scroll_y = payload.scroll_y
            row.chapter_title = payload.chapter_title
            row.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(row)
        return AnchorRead(
            fanfic_id=row.fanfic_id,
            chapter_id=row.chapter_id,
            scroll_y=row.scroll_y,
            chapter_title=row.chapter_title,
            updated_at=row.updated_at,
        )


@router.delete("/anchors/{fanfic_id}", status_code=204)
async def delete_anchor(fanfic_id: str, user_id: str = Depends(_get_current_user_id)):
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(UserAnchor).where(
                UserAnchor.user_id == user_id,
                UserAnchor.fanfic_id == fanfic_id,
            )
        )
        await db.commit()
    return None


# ─── Local history ──────────────────────────────────────────────────────

class HistoryPayload(BaseModel):
    title: str
    author_name: Optional[str] = ""
    author_id: Optional[str] = None
    cover_url: Optional[str] = None
    direction: Optional[str] = None
    rating: Optional[str] = None
    completion_status: Optional[str] = None
    fandoms: Optional[list[str]] = None


class HistoryRead(BaseModel):
    fanfic_id: str
    title: str
    author_name: Optional[str] = ""
    author_id: Optional[str] = None
    cover_url: Optional[str] = None
    direction: Optional[str] = None
    rating: Optional[str] = None
    completion_status: Optional[str] = None
    fandoms: Optional[list[str]] = None
    opened_at: datetime


def _hist_to_read(row: UserLocalHistory) -> HistoryRead:
    fandoms: Optional[list[str]] = None
    if row.fandoms:
        try:
            parsed = json.loads(row.fandoms)
            fandoms = parsed if isinstance(parsed, list) else None
        except json.JSONDecodeError:
            fandoms = None
    return HistoryRead(
        fanfic_id=row.fanfic_id,
        title=row.title,
        author_name=row.author_name or "",
        author_id=row.author_id,
        cover_url=row.cover_url,
        direction=row.direction,
        rating=row.rating,
        completion_status=row.completion_status,
        fandoms=fandoms,
        opened_at=row.opened_at,
    )


@router.get("/local-history", response_model=list[HistoryRead])
async def list_local_history(
    limit: int = Query(200, ge=1, le=500),
    user_id: str = Depends(_get_current_user_id),
):
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(UserLocalHistory)
                .where(UserLocalHistory.user_id == user_id)
                .order_by(UserLocalHistory.opened_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        return [_hist_to_read(r) for r in rows]


@router.put("/local-history/{fanfic_id}", response_model=HistoryRead)
async def upsert_local_history(
    fanfic_id: str,
    payload: HistoryPayload,
    user_id: str = Depends(_get_current_user_id),
):
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                select(UserLocalHistory).where(
                    UserLocalHistory.user_id == user_id,
                    UserLocalHistory.fanfic_id == fanfic_id,
                )
            )
        ).scalar_one_or_none()
        fandoms_str = json.dumps(payload.fandoms, ensure_ascii=False) if payload.fandoms else None
        if row is None:
            row = UserLocalHistory(
                user_id=user_id,
                fanfic_id=fanfic_id,
                title=payload.title,
                author_name=payload.author_name,
                author_id=payload.author_id,
                cover_url=payload.cover_url,
                direction=payload.direction,
                rating=payload.rating,
                completion_status=payload.completion_status,
                fandoms=fandoms_str,
            )
            db.add(row)
        else:
            row.title = payload.title
            row.author_name = payload.author_name
            row.author_id = payload.author_id
            row.cover_url = payload.cover_url
            row.direction = payload.direction
            row.rating = payload.rating
            row.completion_status = payload.completion_status
            row.fandoms = fandoms_str
            row.opened_at = datetime.utcnow()
        await db.commit()
        await db.refresh(row)
        return _hist_to_read(row)


@router.delete("/local-history/{fanfic_id}", status_code=204)
async def delete_local_history_entry(fanfic_id: str, user_id: str = Depends(_get_current_user_id)):
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(UserLocalHistory).where(
                UserLocalHistory.user_id == user_id,
                UserLocalHistory.fanfic_id == fanfic_id,
            )
        )
        await db.commit()
    return None


@router.delete("/local-history", status_code=204)
async def clear_local_history(user_id: str = Depends(_get_current_user_id)):
    async with AsyncSessionLocal() as db:
        await db.execute(delete(UserLocalHistory).where(UserLocalHistory.user_id == user_id))
        await db.commit()
    return None
