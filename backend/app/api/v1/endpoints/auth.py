import uuid
import os
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from app.core.security import create_access_token, verify_token
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.db.repositories.users import UserRepository
from app.db.models.user import UserModel

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY", "")
JWT_EXPIRE_DAYS = 7


class FicbookLoginRequest(BaseModel):
    ficbook_login: str
    ficbook_password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    ficbook_username: Optional[str] = None
    ficbook_avatar_url: Optional[str] = None


@router.post("/ficbook/login", response_model=AuthResponse)
async def ficbook_login(data: FicbookLoginRequest):
    """Login with ficbook.net credentials. Creates platform account if first login."""
    try:
        from ficbook_parser.client import FicbookClient
    except ImportError:
        raise HTTPException(status_code=503, detail="ficbook_parser not available")

    async with FicbookClient(scraper_api_key=SCRAPER_API_KEY or None) as client:
        result = await client.auth.login(data.ficbook_login, data.ficbook_password)

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result.error or "Invalid ficbook credentials",
        )

    ficbook_user = result.user
    ficbook_id = ficbook_user.id if ficbook_user else None
    ficbook_name = ficbook_user.name if ficbook_user else data.ficbook_login
    ficbook_avatar = ficbook_user.avatar_url if ficbook_user else None

    # Fallback: derive synthetic ID from login name if scraping failed
    if not ficbook_id:
        import hashlib
        ficbook_id = "u_" + hashlib.md5(data.ficbook_login.lower().encode()).hexdigest()[:12]
        ficbook_name = data.ficbook_login
        logger.warning(f"Could not scrape ficbook user ID, using synthetic: {ficbook_id}")

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_ficbook_id(ficbook_id)

        if not user:
            synthetic_email = f"ficbook_{ficbook_id}@ficbook.local"
            user = UserModel(
                id=str(uuid.uuid4()),
                email=synthetic_email,
                hashed_password="ficbook_auth",
                ficbook_user_id=ficbook_id,
                ficbook_username=ficbook_name,
                ficbook_avatar_url=ficbook_avatar,
                created_at=datetime.utcnow(),
            )
            await repo.create(user)
            logger.info(f"Created new platform user for ficbook user {ficbook_id}")
        else:
            user.ficbook_username = ficbook_name
            user.ficbook_avatar_url = ficbook_avatar
            user.last_login = datetime.utcnow()
            await repo.update(user)

        # Save ficbook session cookies for profile endpoints
        if hasattr(result, "cookies") and result.cookies:
            await repo.update_cookies(user.id, result.cookies)

        user_id = user.id

    from datetime import timedelta
    token = create_access_token(
        subject=user_id,
        expires_delta=timedelta(days=JWT_EXPIRE_DAYS),
    )

    return AuthResponse(
        access_token=token,
        user_id=user_id,
        ficbook_username=ficbook_name,
        ficbook_avatar_url=ficbook_avatar,
    )


@router.post("/logout")
async def logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    if credentials:
        user_id = verify_token(credentials.credentials)
        if user_id:
            async with AsyncSessionLocal() as db:
                repo = UserRepository(db)
                await repo.clear_cookies(user_id)
    return {"status": "logged out"}


@router.get("/me")
async def get_me(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user.id,
            "ficbook_user_id": user.ficbook_user_id,
            "ficbook_username": user.ficbook_username,
            "ficbook_avatar_url": user.ficbook_avatar_url,
        }
