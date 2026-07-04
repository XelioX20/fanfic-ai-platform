import json
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Union


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"

    DATABASE_URL: str = "postgresql+asyncpg://fanfic:fanfic@localhost:5432/fanficdb"
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 5

    REDIS_URL: str = ""
    KAFKA_BOOTSTRAP_SERVERS: str = ""

    AUTH_SERVICE_URL: str = "http://auth-service:8001"
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    AI_SERVICE_URL: str = "http://ai-services:8002"
    RECOMMENDATION_SERVICE_URL: str = "http://recommendation-engine:8003"
    SEARCH_SERVICE_URL: str = "http://search-engine:8004"

    FICBOOK_EMAIL: str = ""
    FICBOOK_PASSWORD: str = ""
    FICBOOK_RATE_LIMIT_DELAY: float = 2.0
    SCRAPER_API_KEY: str = ""

    CORS_ORIGINS: Union[list[str], str] = ["*"]

    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    CACHE_TTL_FANFIC: int = 3600
    CACHE_TTL_LIST: int = 300
    CACHE_TTL_SEARCH: int = 600
    CACHE_TTL_RECOMMENDATIONS: int = 1800

    # Cloudflare R2 (object storage) — user avatar storage.
    # If any of these is empty, avatar uploads fall back to storing the
    # base64 data-URL directly in the DB (custom_avatar_url TEXT column).
    #
    # Auth via Cloudflare API Bearer token (not S3-compat) so we don't need
    # to provision permanent Access Keys through the dashboard — a single
    # API token with "Workers R2 Storage → Edit" scope covers everything.
    R2_ACCOUNT_ID: str = ""
    R2_API_TOKEN: str = ""
    R2_BUCKET: str = ""
    # Public base URL that serves objects from the bucket. Either the
    # r2.dev URL Cloudflare gives out, or a custom domain bound to the
    # bucket. No trailing slash.
    R2_PUBLIC_URL: str = ""

    def get_cors_origins(self) -> list[str]:
        if isinstance(self.CORS_ORIGINS, str):
            try:
                return json.loads(self.CORS_ORIGINS)
            except Exception:
                return [self.CORS_ORIGINS]
        return self.CORS_ORIGINS


settings = Settings()
