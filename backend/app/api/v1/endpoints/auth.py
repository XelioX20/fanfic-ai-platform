import uuid
import os
import logging
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from app.core.security import create_access_token, verify_token
from app.db.session import AsyncSessionLocal
from app.db.repositories.users import UserRepository
from app.db.models.user import UserModel

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

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
    scraper_api_key = os.environ.get("SCRAPER_API_KEY", "")

    try:
        from ficbook_parser.client import FicbookClient
    except ImportError:
        raise HTTPException(status_code=503, detail="ficbook_parser not available")

    try:
        async with FicbookClient(scraper_api_key=scraper_api_key or None) as client:
            result = await client.auth.login(data.ficbook_login, data.ficbook_password)
    except Exception as e:
        logger.error(f"FicbookClient error during login: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Auth error: {e}")

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result.error or "Invalid ficbook credentials",
        )

    ficbook_user = result.user
    ficbook_id = ficbook_user.id if ficbook_user else None
    ficbook_name = ficbook_user.name if ficbook_user else data.ficbook_login
    ficbook_avatar = ficbook_user.avatar_url if ficbook_user else None

    # If profile scraping failed but auth succeeded, use login as fallback name
    # but still require that ficbook_id exists (scraping /home page)
    if not ficbook_id:
        # Try to extract from stored cookies by fetching /home directly
        logger.warning(f"Profile scraping returned no user ID for login: {data.ficbook_login}")
        import hashlib
        ficbook_id = "u_" + hashlib.md5(data.ficbook_login.lower().encode()).hexdigest()[:12]
        ficbook_name = data.ficbook_login

    try:
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
                logger.info(f"Created platform user for ficbook {ficbook_id}")
            else:
                user.ficbook_username = ficbook_name
                user.ficbook_avatar_url = ficbook_avatar
                user.last_login = datetime.utcnow()
                await repo.update(user)

            # Save ficbook session cookies for profile endpoints
            if getattr(result, "cookies", None):
                await repo.update_cookies(user.id, result.cookies)

            user_id = user.id
    except Exception as e:
        logger.error(f"DB error during login: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

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


@router.get("/debug-login")
async def debug_login(login: str = "fake_user", password: str = "wrongpass"):
    """Debug: show what login flow returns from ficbook.net."""
    scraper_api_key = os.environ.get("SCRAPER_API_KEY", "")
    import random, httpx
    from bs4 import BeautifulSoup

    session_number = random.randint(1, 9999)
    base_params = {"api_key": scraper_api_key, "session_number": session_number, "render": "false"}
    SCRAPERAPI_BASE = "http://api.scraperapi.com/"
    FICBOOK_BASE = "https://ficbook.net"

    jar: dict = {}

    def collect(resp):
        for name, value in resp.headers.multi_items():
            if name.lower() == "set-cookie":
                part = value.split(";")[0].strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    jar[k.strip()] = v.strip()

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=False) as client:
        r1 = await client.get(SCRAPERAPI_BASE, params={**base_params, "url": f"{FICBOOK_BASE}/login"})
        collect(r1)
        html1 = r1.content.decode("utf-8", errors="replace")
        soup1 = BeautifulSoup(html1, "html.parser")
        csrf_el = soup1.select_one("input[name=_csrf_token]")
        csrf = csrf_el.get("value", "") if csrf_el else ""

        post_headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if jar:
            post_headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in jar.items())

        r2 = await client.post(
            SCRAPERAPI_BASE,
            params={**base_params, "url": f"{FICBOOK_BASE}/login_check"},
            data={"login": login, "password": password, "_csrf_token": csrf},
            headers=post_headers,
        )
        collect(r2)
        html2 = r2.content.decode("utf-8", errors="replace")

        verify_headers = {}
        if jar:
            verify_headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in jar.items())

        r3 = await client.get(SCRAPERAPI_BASE, params={**base_params, "url": f"{FICBOOK_BASE}/home"}, headers=verify_headers)
        html3 = r3.content.decode("utf-8", errors="replace")

    return {
        "csrf_found": bool(csrf),
        "cookies_after_post": list(jar.keys()),
        "r1_status": r1.status_code,
        "r2_status": r2.status_code,
        "r2_html_snippet": html2[:500],
        "r3_status": r3.status_code,
        "r3_html_snippet": html3[1000:2000],
        "r3_has_logout": "Выйти" in html3 or "logout" in html3.lower(),
        "r3_has_login_form": "_csrf_token" in html3,
        "r3_has_войти_in_nav": "Войти" in html3[:3000],
    }


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
