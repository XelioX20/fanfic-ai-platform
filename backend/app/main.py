from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import logging
import asyncio
import sys
import os
import time
import httpx
from collections import deque

# Ensure backend root is in path so ficbook_parser (bundled alongside app/) is importable
_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import create_tables, AsyncSessionLocal
from app.db.repositories.fanfics import FanficRepository
from app.db.models.fanfic import Fanfic
# Import reco models so Base.metadata.create_all() creates their tables
# (user_taste_vectors, user_recommendations) on boot.
from app.db.models import reco as _reco_models  # noqa: F401

logger = logging.getLogger(__name__)


async def seed_from_ficbook():
    """If DB is empty, scrape popular fanfics from ficbook.net on startup."""
    async with AsyncSessionLocal() as db:
        repo = FanficRepository(db)
        _, total = await repo.get_many(limit=1)
        if total > 0:
            logger.info(f"DB already has {total} fanfics, skipping initial scrape")
            return

    logger.info("DB is empty — starting initial scrape from ficbook.net")
    from app.services.scraper_service import ScraperService
    scraper = ScraperService()
    fanfics_data = await scraper.scrape_popular(pages_per_section=2)

    if not fanfics_data:
        logger.warning("Scraper returned no fanfics (ficbook_parser may not be installed)")
        return

    async with AsyncSessionLocal() as db:
        repo = FanficRepository(db)
        fanfics = [Fanfic(**{k: v for k, v in data.items() if hasattr(Fanfic, k)}) for data in fanfics_data]
        saved = await repo.bulk_upsert(fanfics)
        logger.info(f"Saved {len(saved)} fanfics to DB")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting fanfic-ai-platform backend (env={settings.APP_ENV})")

    # Process-wide HTTP client — reused across all outbound calls to the CF
    # Worker, ficbook.net, etc. Creating a fresh AsyncClient per request costs
    # ~150-400ms in DNS + TCP + TLS handshake (measured); the pool eliminates
    # that on every cache-miss request.
    app.state.http = httpx.AsyncClient(
        headers={
            "User-Agent": "AppleWebKit/605.1",
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9",
        },
        timeout=60.0,
        follow_redirects=True,
        limits=httpx.Limits(max_keepalive_connections=32, max_connections=64),
    )

    await create_tables()
    # Run initial scrape in background — don't block startup
    asyncio.create_task(seed_from_ficbook())
    yield
    logger.info("Shutting down")
    await app.state.http.aclose()


app = FastAPI(
    title="Fanfic AI Platform API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Rate limiter (per-IP sliding window) ────────────────────────────────
#
# Prevents accidental request storms (e.g. a client stuck in a retry loop)
# and cheap DDoS from hitting our upstream (ficbook.net scraping is
# expensive and gets us blocked if too aggressive).
#
# 60 requests per 60 seconds per IP. Tuned to be generous enough for
# normal browsing (rail scroll, chapter navigation) but strict enough to
# catch runaway scripts. In-memory only — one Render dyno so a shared
# state store isn't needed.
_RATE_WINDOW_SEC = 60
_RATE_MAX_REQUESTS = 120  # ~2 per second sustained
_hits: dict[str, deque[float]] = {}


def _client_ip(request: Request) -> str:
    # X-Forwarded-For is set by Render's edge; prefer its first value.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    # Skip rate-limiting on health checks (Render pings /health every 30s)
    # and OPTIONS preflight requests.
    if request.method == "OPTIONS" or request.url.path in ("/health", "/"):
        return await call_next(request)

    ip = _client_ip(request)
    now = time.monotonic()
    window = _hits.setdefault(ip, deque())
    # Drop entries older than the window.
    while window and now - window[0] > _RATE_WINDOW_SEC:
        window.popleft()

    if len(window) >= _RATE_MAX_REQUESTS:
        retry_after = _RATE_WINDOW_SEC - int(now - window[0])
        return JSONResponse(
            status_code=429,
            content={"detail": "Слишком много запросов. Подожди немного."},
            headers={"Retry-After": str(max(retry_after, 1))},
        )

    window.append(now)
    return await call_next(request)


app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "fanfic-ai-platform-backend", "env": settings.APP_ENV}
