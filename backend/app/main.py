from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import logging
import asyncio
import sys
import os

# Ensure backend root is in path so ficbook_parser (bundled alongside app/) is importable
_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import create_tables, AsyncSessionLocal
from app.db.repositories.fanfics import FanficRepository
from app.db.models.fanfic import Fanfic

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
    await create_tables()
    # Run initial scrape in background — don't block startup
    asyncio.create_task(seed_from_ficbook())
    yield
    logger.info("Shutting down")


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

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "fanfic-ai-platform-backend", "env": settings.APP_ENV}



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

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "fanfic-ai-platform-backend", "env": settings.APP_ENV}
