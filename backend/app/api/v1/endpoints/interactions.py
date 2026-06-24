from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from app.core.dependencies import get_db, get_current_user
from app.db.models.user import UserModel
from app.db.models.interaction import UserFanficInteraction
from app.db.repositories.fanfics import FanficRepository

router = APIRouter()


class InteractionCreate(BaseModel):
    fanfic_id: str
    interaction_type: str
    reading_progress: Optional[float] = None
    reading_time_seconds: Optional[int] = None
    chapter_id: Optional[str] = None
    rating: Optional[float] = None
    is_bookmarked: Optional[bool] = None
    is_liked: Optional[bool] = None
    is_finished: Optional[bool] = None


@router.post("/", status_code=status.HTTP_201_CREATED)
async def record_interaction(
    data: InteractionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    fanfic_repo = FanficRepository(db)
    fanfic = await fanfic_repo.get_by_id(data.fanfic_id)
    if not fanfic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fanfic not found")
    interaction = UserFanficInteraction(
        user_id=current_user.id,
        fanfic_id=data.fanfic_id,
        interaction_type=data.interaction_type,
        reading_progress=data.reading_progress,
        reading_time_seconds=data.reading_time_seconds or 0,
        chapter_id=data.chapter_id,
        rating=data.rating,
        is_bookmarked=data.is_bookmarked or False,
        is_liked=data.is_liked or False,
        is_finished=data.is_finished or False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(interaction)
    await db.commit()
    return {"status": "ok"}
