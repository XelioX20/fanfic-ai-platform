from typing import Optional
import httpx
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.config import settings
from app.core.dependencies import get_current_user, get_current_user_optional
from app.db.models.user import UserModel

router = APIRouter()


@router.get("/for-me")
async def get_recommendations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: UserModel = Depends(get_current_user),
):
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.RECOMMENDATION_SERVICE_URL}/recommend",
                json={"user_id": current_user.id, "page": page, "page_size": page_size},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Recommendation service unavailable: {e}")


@router.get("/similar/{fanfic_id}")
async def get_similar(
    fanfic_id: str,
    limit: int = Query(10, ge=1, le=30),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/similar/{fanfic_id}",
                params={"limit": limit, "user_id": current_user.id if current_user else None},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Recommendation service unavailable: {e}")


@router.get("/trending")
async def get_trending(
    period: str = Query("week", pattern="^(day|week|month)$"),
    limit: int = Query(20, ge=1, le=50),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/trending",
                params={"period": period, "limit": limit},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Recommendation service unavailable: {e}")
