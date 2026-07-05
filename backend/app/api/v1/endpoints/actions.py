"""
Ficbook.net user action endpoints — like, mark read, follow fanfic, download.
All use ficbook's internal AJAX JSON endpoints confirmed to work without proxy.
"""
import os
import re
import html as html_lib
import json
import httpx
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from app.core.security import verify_token
from app.db.session import AsyncSessionLocal
from app.db.repositories.users import UserRepository

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

FICBOOK_BASE = "https://ficbook.net"
UA = "AppleWebKit/605.1"
WORKER_URL = os.environ.get("FICBOOK_WORKER_URL", "https://ficbook-proxy.fanfic-ai-xelio.workers.dev")


async def _get_user_cookies(user_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user or not user.ficbook_cookies:
            raise HTTPException(status_code=403, detail="Not logged in to ficbook. Please log in again.")
        return user.ficbook_cookies


async def _get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


async def _ficbook_post(path: str, data: dict, cookies: dict) -> dict:
    """POST to ficbook.net AJAX endpoint via Cloudflare Worker with user session cookies."""
    worker_url = WORKER_URL
    cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.post(
            f"{worker_url}/{path}",
            data=data,
            headers={
                "User-Agent": UA,
                "x-ficbook-cookie": cookie_str,
                "X-Requested-With": "XMLHttpRequest",
                "Referer": f"{FICBOOK_BASE}/",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        resp.raise_for_status()
        return resp.json()


class FanficActionRequest(BaseModel):
    fanfic_id: str


@router.post("/like")
async def like_fanfic(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Like a fanfic (POST /ajax/mark with action=add)."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("ajax/mark", {"fanfic_id": data.fanfic_id, "action": "add"}, cookies)
        return {"success": result.get("result", False), "action": "liked"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/unlike")
async def unlike_fanfic(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Unlike a fanfic (POST /ajax/mark with action=remove)."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("ajax/mark", {"fanfic_id": data.fanfic_id, "action": "remove"}, cookies)
        return {"success": result.get("result", False), "action": "unliked"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/mark-read")
async def mark_read(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Mark fanfic as read (POST /fanfic_read/read)."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("fanfic_read/read", {"fanfic_id": data.fanfic_id}, cookies)
        return {"success": result.get("result", False), "action": "marked_read"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/mark-unread")
async def mark_unread(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Mark fanfic as unread."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("fanfic_read/unread", {"fanfic_id": data.fanfic_id}, cookies)
        return {"success": result.get("result", False), "action": "marked_unread"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/follow")
async def follow_fanfic(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Follow/subscribe to fanfic updates."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("fanfic_follow/follow", {"fanfic_id": data.fanfic_id}, cookies)
        return {"success": result.get("result", False), "action": "followed"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/unfollow")
async def unfollow_fanfic(
    data: FanficActionRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """Unfollow fanfic."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("fanfic_follow/unfollow", {"fanfic_id": data.fanfic_id}, cookies)
        return {"success": result.get("result", False), "action": "unfollowed"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/state/{fanfic_id}")
async def get_fanfic_state(
    fanfic_id: str,
    user_id: str = Depends(_get_current_user_id),
):
    """Get current like/read/follow state for a fanfic (POST /ajax/fanfic_actions_state)."""
    cookies = await _get_user_cookies(user_id)
    try:
        result = await _ficbook_post("ajax/fanfic_actions_state", {"fanfic_id": fanfic_id}, cookies)
        data = result.get("data", {})
        return {
            "is_liked": data.get("isLiked", False),
            "is_read": data.get("isFullyRead", False),
            "is_followed": data.get("isFollowed", False),
        }
    except Exception as e:
        return {"is_liked": False, "is_read": False, "is_followed": False}


CONTENT_TYPES = {
    "txt":  "text/plain",
    "epub": "application/epub+zip",
    "pdf":  "application/pdf",
    "fb2":  "application/x-fictionbook+xml",
}


def _extract_balance(html: str) -> str:
    """Best-effort read of the coin balance from the embedded userInfo JS."""
    m = re.search(r'balance\s*:\s*(\d+)', html)
    return m.group(1) if m else "?"


def _extract_download_link(html: str, fmt: str) -> Optional[str]:
    """
    Extract the download link for the given format from the /readfic/{id}/download page.

    Modern ficbook renders the download UI as a Vue component:
        <fanfic-download-button :download-links="[{...}, ...]" ...>
    where download-links is an HTML-attribute-encoded JSON array of
    {link, icon, label, metricsId} entries, one per format.

    Returns the raw path (e.g. "/fanfic_download/{uuid}/Title.txt") or None.
    """
    # 1) Try to find :download-links="..." attribute value
    m = re.search(r':download-links\s*=\s*"([^"]+)"', html)
    if m:
        raw = html_lib.unescape(m.group(1))
        # HTML attribute escaping uses &quot; for " — after unescape we have valid JSON
        try:
            links = json.loads(raw)
        except json.JSONDecodeError:
            # Sometimes it may still contain escaped slashes as \/ — that's valid JSON, so shouldn't fail
            links = None
        if isinstance(links, list):
            for entry in links:
                link = entry.get("link") if isinstance(entry, dict) else None
                if link and link.lower().endswith("." + fmt):
                    return link

    # 2) Fallback — search for any /fanfic_download/.../*.{fmt} anywhere in the HTML
    m = re.search(r'(/fanfic_download/[^"\'\s<>]+\.' + re.escape(fmt) + r')', html)
    if m:
        return m.group(1)

    return None


@router.get("/download/{fanfic_id}/{fmt}")
async def download_fanfic(
    fanfic_id: str,
    fmt: str,
    user_id: str = Depends(_get_current_user_id),
):
    """
    Download a fanfic as txt/epub/pdf/fb2 through ficbook using the user's stored session.

    Flow:
      1. Load user's ficbook cookies (PHPSESSID etc.) from DB.
      2. GET /readfic/{fanfic_id}/download via Worker with those cookies.
      3. Parse the <fanfic-download-button :download-links="..."> Vue prop to find
         the direct /fanfic_download/{uuid}/{Slug}.{ext} URL for the requested format.
         (There is no <form>, no CSRF token, no computed hash — plain GET is enough
          as long as PHPSESSID is a logged-in session.)
      4. GET that URL via Worker with the user's cookies.
      5. Stream the response body back to the client with Content-Type and
         Content-Disposition.
    """
    if fmt not in CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}")

    cookies = await _get_user_cookies(user_id)
    cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        # Step 1: fetch the download landing page via Worker
        page_url = f"{WORKER_URL}/readfic/{fanfic_id}/download"
        try:
            page_resp = await client.get(
                page_url,
                headers={
                    "User-Agent": UA,
                    "x-ficbook-cookie": cookie_str,
                    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                },
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch download page: {e}")

        if page_resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Ficbook returned {page_resp.status_code} for download page",
            )

        # If ficbook redirected to /login, the worker follows it — detect via URL or body.
        final_url = str(page_resp.url)
        if "/login" in final_url and "ficbook" in final_url:
            raise HTTPException(status_code=403, detail="Ficbook session expired. Please log in again.")

        page_html = page_resp.content.decode("utf-8", errors="replace")

        # Sanity check: the page renders "Войдите в аккаунт" modal when not logged in,
        # even though it returns 200. Detect that and fail fast.
        if 'window.ficbook' in page_html and '"isLoggedIn":false' in page_html.replace(" ", ""):
            raise HTTPException(status_code=403, detail="Ficbook session not authenticated. Please log in again.")

        # Ficbook removed web downloads for regular accounts in ~2026. The
        # landing page still renders the Скачать TXT/ePUB/PDF/FB2 buttons,
        # but clicking any of them shows a modal:
        #   "Скачивание работ недоступно на сайте.
        #    Перейдите в мобильное приложение или улучшите аккаунт"
        # and the direct /fanfic_download/... URLs return 404 for everyone
        # except premium subscribers. There's no bypass — ficbook simply
        # doesn't serve the files. Detect the modal text and surface a
        # helpful error to the user.
        if "Скачивание работ недоступно" in page_html:
            raise HTTPException(
                status_code=451,   # Unavailable For Legal Reasons — closest match
                detail=(
                    "Скачивание отключено в веб-версии ficbook. "
                    "Файлы доступны только в мобильном приложении ficbook "
                    "или для premium-аккаунтов."
                ),
            )

        # Diagnostic — helps figure out why direct downloads 404 even when
        # the landing page renders. Look for premium/coin flags in the
        # embedded userInfo payload.
        try:
            logger.info(
                "Download landing for %s (%s): isLoggedIn=%s isPremium=%s balance=%s len=%d",
                fanfic_id, fmt,
                "true" if '"isLoggedIn":true' in page_html.replace(" ", "") else "false",
                "true" if '"isPremium":true' in page_html.replace(" ", "") else "false",
                _extract_balance(page_html),
                len(page_html),
            )
        except Exception:
            pass

        # Step 2: extract the direct download link for this format
        link = _extract_download_link(page_html, fmt)
        if not link:
            raise HTTPException(
                status_code=502,
                detail=f"Download link for .{fmt} not found on ficbook page",
            )
        logger.info(f"Download link for {fanfic_id}.{fmt}: {link}")

        # Step 3: GET the actual download.
        # link is e.g. "/fanfic_download/{uuid}/Title.txt"
        # We try the Worker first (bypasses IP blocking for the Render dyno),
        # then fall back to direct ficbook.net on 404 — the Worker
        # occasionally strips Cookie headers on certain paths.
        async def _try_download(via: str) -> httpx.Response:
            base = WORKER_URL if via == "worker" else FICBOOK_BASE
            return await client.get(
                f"{base}{link}",
                headers={
                    "User-Agent": UA,
                    **({"x-ficbook-cookie": cookie_str} if via == "worker" else {"Cookie": cookie_str}),
                    "Referer": f"{FICBOOK_BASE}/readfic/{fanfic_id}/download",
                    "Accept": "*/*",
                },
            )

        try:
            dl_resp = await _try_download("worker")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch download file: {e}")

        if dl_resp.status_code != 200:
            logger.warning(
                f"Ficbook download failed for {fanfic_id}.{fmt}: "
                f"url={WORKER_URL}{link}, status={dl_resp.status_code}, "
                f"body={dl_resp.content[:300]!r}"
            )
            # 429 = rate limit from ficbook (throttles downloads per session)
            if dl_resp.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Ficbook ограничил частоту скачиваний. Попробуй через 5–10 минут.",
                )
            # 403 usually means session lost or fanfic requires premium
            if dl_resp.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="Скачивание недоступно (возможно нужна авторизация или премиум на ficbook).",
                )
            # 404 — try three recovery paths in order:
            #   a) Wait 1.5s + retry via Worker (ficbook lazily generates
            #      download files on first hit)
            #   b) Bypass the Worker and hit ficbook.net directly (Worker
            #      may be stripping cookies on this path)
            # If both fail we surface a helpful message.
            if dl_resp.status_code == 404:
                import asyncio
                await asyncio.sleep(1.5)
                try:
                    retry_resp = await _try_download("worker")
                    if retry_resp.status_code == 200:
                        dl_resp = retry_resp
                    else:
                        logger.warning(
                            f"Worker retry after 404 for {fanfic_id}.{fmt} still returned "
                            f"{retry_resp.status_code} — trying direct ficbook"
                        )
                        direct_resp = await _try_download("direct")
                        if direct_resp.status_code == 200:
                            dl_resp = direct_resp
                        else:
                            logger.warning(
                                f"Direct ficbook download for {fanfic_id}.{fmt} returned "
                                f"{direct_resp.status_code}: {direct_resp.content[:300]!r}"
                            )
                            raise HTTPException(
                                status_code=502,
                                detail=(
                                    "Ficbook не отдал файл для скачивания. "
                                    "Возможно фанфик слишком большой, требует premium или временный сбой."
                                ),
                            )
                except httpx.HTTPError:
                    raise HTTPException(
                        status_code=502,
                        detail="Ficbook не отдал файл для скачивания — попробуй позже.",
                    )
            else:
                raise HTTPException(
                    status_code=502,
                    detail=f"Ficbook returned {dl_resp.status_code} for download file",
                )

        # If we got redirected to login, session is bad
        dl_final = str(dl_resp.url)
        if "/login" in dl_final and "ficbook" in dl_final:
            raise HTTPException(status_code=403, detail="Ficbook session expired. Please log in again.")

        # Extract a filename — prefer the last path segment of the download link
        filename = link.rsplit("/", 1)[-1] or f"fanfic_{fanfic_id}.{fmt}"

        # Also try Content-Disposition from ficbook (may carry a cleaner filename)
        disp = dl_resp.headers.get("content-disposition", "")
        if disp:
            fn_match = re.search(
                r"filename\*\s*=\s*(?:UTF-8'')?\"?([^\";]+)\"?",
                disp,
                flags=re.IGNORECASE,
            ) or re.search(
                r'filename\s*=\s*"?([^";]+)"?',
                disp,
                flags=re.IGNORECASE,
            )
            if fn_match:
                filename = fn_match.group(1).strip()

        body = dl_resp.content

        return StreamingResponse(
            content=iter([body]),
            media_type=CONTENT_TYPES[fmt],
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(body)),
            },
        )
