from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db, get_current_user_optional
from app.db.repositories.fanfics import FanficRepository
from app.db.models.user import UserModel
from app.schemas.fanfic import FanficRead, FanficListResponse

router = APIRouter()


@router.get("/", response_model=FanficListResponse)
async def list_fanfics(
    direction: Optional[str] = Query(None),
    rating: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    fandom: Optional[str] = Query(None),
    min_words: Optional[int] = Query(None),
    max_words: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    repo = FanficRepository(db)
    offset = (page - 1) * page_size
    fanfics, total = await repo.get_many(
        offset=offset, limit=page_size,
        direction=direction, rating=rating, status=status,
        fandom=fandom, min_words=min_words, max_words=max_words,
    )
    return FanficListResponse(
        items=[FanficRead.model_validate(f) for f in fanfics],
        total=total, page=page, page_size=page_size,
        has_next=(offset + page_size) < total,
    )


@router.get("/{fanfic_id}", response_model=FanficRead)
async def get_fanfic(
    fanfic_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    repo = FanficRepository(db)
    fanfic = await repo.get_by_id(fanfic_id)
    if not fanfic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fanfic not found")
    return FanficRead.model_validate(fanfic)
