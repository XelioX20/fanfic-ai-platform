from fastapi import APIRouter, Depends, BackgroundTasks, status
from pydantic import BaseModel
from app.core.dependencies import get_current_user
from app.db.models.user import UserModel
from app.services.scraper_service import ScraperService

router = APIRouter()


class ScrapeRequest(BaseModel):
    fanfic_id: str


class ScrapeListRequest(BaseModel):
    section_path: str = "/"
    pages: int = 1


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
