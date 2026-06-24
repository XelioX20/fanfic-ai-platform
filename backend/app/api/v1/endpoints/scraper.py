import logging
from fastapi import APIRouter, Depends, BackgroundTasks, status
from pydantic import BaseModel
from app.core.dependencies import get_current_user
from app.db.models.user import UserModel
from app.db.models.fanfic import Fanfic
from app.db.session import AsyncSessionLocal
from app.db.repositories.fanfics import FanficRepository
from app.services.scraper_service import ScraperService

router = APIRouter()
logger = logging.getLogger(__name__)


class ScrapeRequest(BaseModel):
    fanfic_id: str


class ScrapeListRequest(BaseModel):
    section_path: str = "/"
    pages: int = 1


async def _run_seed():
    """Background task: scrape popular fanfics and save to DB."""
    try:
        scraper = ScraperService()
        fanfics_data = await scraper.scrape_popular(pages_per_section=2)
        if not fanfics_data:
            logger.warning("Scraper returned 0 fanfics")
            return 0
        async with AsyncSessionLocal() as db:
            repo = FanficRepository(db)
            allowed = {c.key for c in Fanfic.__table__.columns}
            fanfics = [Fanfic(**{k: v for k, v in d.items() if k in allowed}) for d in fanfics_data]
            saved = await repo.bulk_upsert(fanfics)
            logger.info(f"Seed complete: saved {len(saved)} fanfics")
            return len(saved)
    except Exception as e:
        logger.error(f"Seed failed: {e}", exc_info=True)
        return 0


@router.post("/seed", status_code=status.HTTP_202_ACCEPTED)
async def seed_fanfics(background_tasks: BackgroundTasks):
    """Public endpoint: trigger scraping popular fanfics from ficbook.net."""
    background_tasks.add_task(_run_seed)
    return {"status": "accepted", "message": "Scraping started in background. Check /api/v1/fanfics/ in ~2 minutes."}


@router.get("/status")
async def scraper_status():
    """Check how many fanfics are in DB and whether ficbook_parser is available."""
    try:
        from ficbook_parser.client import FicbookClient
        parser_available = True
    except ImportError:
        parser_available = False

    async with AsyncSessionLocal() as db:
        repo = FanficRepository(db)
        _, total = await repo.get_many(limit=1)

    return {
        "ficbook_parser_installed": parser_available,
        "fanfics_in_db": total,
    }


@router.post("/fanfic", status_code=status.HTTP_202_ACCEPTED)
async def scrape_fanfic(
    data: ScrapeRequest,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
):
    scraper = ScraperService()
    background_tasks.add_task(scraper.scrape_fanfic, data.fanfic_id)
    return {"status": "accepted", "fanfic_id": data.fanfic_id}


@router.post("/list", status_code=status.HTTP_202_ACCEPTED)
async def scrape_list(
    data: ScrapeListRequest,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
):
    scraper = ScraperService()
    background_tasks.add_task(scraper.scrape_section, data.section_path, data.pages)
    return {"status": "accepted", "section": data.section_path, "pages": data.pages}
