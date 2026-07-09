from fastapi import APIRouter
from app.api.v1.endpoints import fanfics, search, recommendations, users, interactions, scraper, reader, auth, profile, discover, actions, reading_state, internal

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(fanfics.router, prefix="/fanfics", tags=["fanfics"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(interactions.router, prefix="/interactions", tags=["interactions"])
api_router.include_router(scraper.router, prefix="/scraper", tags=["scraper"])
api_router.include_router(reader.router, tags=["reader"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(discover.router, prefix="/discover", tags=["discover"])
api_router.include_router(actions.router, prefix="/actions", tags=["actions"])
# Cross-device sync of anchors + local history — see reading_state.py
api_router.include_router(reading_state.router, prefix="/profile", tags=["reading-state"])
# Recommendation pipeline internal/diagnostic endpoints (secret-gated)
api_router.include_router(internal.router, prefix="/internal", tags=["internal"])
