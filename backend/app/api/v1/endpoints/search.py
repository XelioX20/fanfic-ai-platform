from typing import Optional
import httpx
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.config import settings
from app.core.dependencies import get_current_user_optional
from app.db.models.user import UserModel

router = APIRouter()


@router.get("/")
async def search_fanfics(
    q: str = Query(..., min_length=1, description="Natural language search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.SEARCH_SERVICE_URL}/search",
                json={
                    "query": q,
                    "page": page,
                    "page_size": page_size,
                    "user_id": current_user.id if current_user else None,
                },
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Search service unavailable: {e}")


@router.get("/suggest")
async def search_suggest(q: str = Query(..., min_length=1)):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.SEARCH_SERVICE_URL}/suggest", params={"q": q})
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError:
        return {"suggestions": []}
