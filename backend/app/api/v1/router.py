from fastapi import APIRouter
from app.api.v1.endpoints import fanfics, search, recommendations, users, interactions, scraper

api_router = APIRouter()
api_router.include_router(fanfics.router, prefix="/fanfics", tags=["fanfics"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(interactions.router, prefix="/interactions", tags=["interactions"])
api_router.include_router(scraper.router, prefix="/scraper", tags=["scraper"])
