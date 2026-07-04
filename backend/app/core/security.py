from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from app.core.config import settings


def _prep(pw: str) -> bytes:
    # bcrypt caps at 72 bytes; trim explicitly so bcrypt>=5 doesn't raise.
    return pw.encode("utf-8")[:72]


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"sub": subject, "exp": expire, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def hash_password(password: str) -> str:
    """Hash `password` with bcrypt. Returns the standard `$2b$…` string."""
    hashed = bcrypt.hashpw(_prep(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prep(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
