import logging
import sys
import os
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


@router.get("/encoding-test")
async def encoding_test():
    """Test what encoding ScraperAPI returns for ficbook.net."""
    scraper_api_key = os.environ.get("SCRAPER_API_KEY", "")
    import httpx, urllib.parse
    target = "https://ficbook.net/fanfiction"
    if scraper_api_key:
        encoded = urllib.parse.quote(target, safe="")
        url = f"http://api.scraperapi.com/?api_key={scraper_api_key}&url={encoded}"
    else:
        url = target
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        raw = resp.content
        content_type = resp.headers.get("content-type", "")
        # Try different decodings
        try:
            utf8 = raw.decode("utf-8")
            utf8_ok = "Джен" in utf8 or "Автор" in utf8 or "fanfic" in utf8.lower()
        except Exception as e:
            utf8 = str(e)
            utf8_ok = False
        try:
            latin1 = raw.decode("latin-1")
            latin1_reenc = latin1.encode("latin-1").decode("utf-8", errors="replace")
            latin1_ok = "Джен" in latin1_reenc or "Автор" in latin1_reenc
        except Exception as e:
            latin1_reenc = str(e)
            latin1_ok = False
        # Show sample of raw bytes around a known Russian word
        sample_bytes = raw[2000:2100].hex()
        return {
            "content_type": content_type,
            "utf8_contains_russian": utf8_ok,
            "latin1_reenc_contains_russian": latin1_ok,
            "sample_bytes_hex": sample_bytes,
            "utf8_sample": utf8[2000:2100] if utf8_ok else "N/A",
        }


@router.delete("/clear-db")
async def clear_fanfics_db():
    """Delete all fanfics from DB so reseed picks up fresh data."""
    from sqlalchemy import text
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("DELETE FROM fanfics"))
        await db.commit()
        return {"deleted": result.rowcount}


@router.get("/seed-sync")
async def seed_fanfics_sync():
    """Synchronous seed — runs inline and returns result. For debugging only."""
    try:
        scraper = ScraperService()
        fanfics_data = await scraper.scrape_popular(pages_per_section=1)
        if not fanfics_data:
            return {"error": "scraper returned 0 fanfics"}

        async with AsyncSessionLocal() as db:
            repo = FanficRepository(db)
            allowed = {c.key for c in Fanfic.__table__.columns}
            fanfics = [Fanfic(**{k: v for k, v in d.items() if k in allowed}) for d in fanfics_data]
            saved = await repo.bulk_upsert(fanfics)
            return {
                "scraped": len(fanfics_data),
                "saved": len(saved),
                "sample": fanfics_data[0] if fanfics_data else None,
            }
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()[-1000:]}


@router.get("/test-ua")
async def test_ua():
    """Test which ficbook.net paths work from this server IP with AppleWebKit UA."""
    import httpx
    headers = {
        "User-Agent": "AppleWebKit/605.1",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9",
    }
    results = {}
    urls = {
        "fanfiction": "https://ficbook.net/fanfiction",
        "popular": "https://ficbook.net/popular-fanfics-376846",
        "search": "https://ficbook.net/find-fanfics-846555?title=гарри",
        "login_page": "https://ficbook.net/login",
    }
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for name, url in urls.items():
            try:
                r = await client.get(url, headers=headers)
                from ficbook_parser.parsers.fanfic_list import FanficListParser
                raw = r.content.decode("utf-8", errors="replace")
                fanfics, has_next = FanficListParser().parse(raw)
                results[name] = {"status": r.status_code, "fanfics": len([f for f in fanfics if f.id]), "has_next": has_next}
            except Exception as e:
                results[name] = {"error": str(e)[:100]}
    return results


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


@router.get("/test")
async def test_scraper():
    """Synchronously scrape 1 page and return raw result for debugging."""
    try:
        from ficbook_parser.client import FicbookClient
    except ImportError:
        return {"error": "ficbook_parser not installed"}

    import os
    email = os.environ.get("FICBOOK_EMAIL", "")
    password = os.environ.get("FICBOOK_PASSWORD", "")
    scraper_api_key = os.environ.get("SCRAPER_API_KEY", "")

    try:
        async with FicbookClient(scraper_api_key=scraper_api_key or None) as client:
            if email and password:
                auth = await client.auth.login(email, password)
                auth_status = f"logged in as {auth.user.name}" if auth.success and auth.user else f"auth failed: {auth.error}"
            else:
                auth_status = "no credentials (guest mode)"

            fanfics, has_next = await client.fanfics_list.get("fanfiction", page=1)
            return {
                "scraper_api_key_set": bool(scraper_api_key),
                "auth": auth_status,
                "fanfics_count": len(fanfics),
                "has_next": has_next,
                "first_fanfic": fanfics[0].title if fanfics else None,
            }
    except Exception as e:
        return {"scraper_api_key_set": bool(scraper_api_key), "error": str(e), "type": type(e).__name__}


@router.get("/html-sample")
async def get_html_sample():
    """Fetch raw HTML of ficbook.net fanfiction page for selector debugging."""
    scraper_api_key = os.environ.get("SCRAPER_API_KEY", "")
    try:
        import httpx, urllib.parse
        target = "https://ficbook.net/fanfiction"
        if scraper_api_key:
            encoded = urllib.parse.quote(target, safe="")
            url = f"http://api.scraperapi.com/?api_key={scraper_api_key}&url={encoded}"
        else:
            url = target
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            html = resp.text
            # Extract first article element
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            article = soup.select_one("article[class*=fanfic-inline]")
            if article:
                return {"found": True, "html": str(article)[:3000], "classes": article.get("class")}
            # Show available article classes
            all_articles = soup.find_all("article")
            return {
                "found": False,
                "article_count": len(all_articles),
                "article_classes": [a.get("class") for a in all_articles[:3]],
                "html_snippet": html[5000:8000],
            }
    except Exception as e:
        return {"error": str(e)}


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


@router.get("/debug")
async def debug_env():
    """Show Python path and filesystem for diagnosing import issues."""
    cwd = os.getcwd()
    files_in_cwd = os.listdir(cwd)
    parent = os.path.dirname(cwd)
    files_in_parent = os.listdir(parent) if os.path.exists(parent) else []

    # Try import and capture exact error
    import_error = None
    try:
        from ficbook_parser.client import FicbookClient
        import_ok = True
    except Exception as e:
        import_ok = False
        import_error = f"{type(e).__name__}: {e}"

    return {
        "cwd": cwd,
        "files_in_cwd": sorted(files_in_cwd),
        "sys_path": sys.path[:8],
        "PYTHONPATH": os.environ.get("PYTHONPATH", "NOT SET"),
        "ficbook_parser_import_ok": import_ok,
        "ficbook_parser_import_error": import_error,
    }
