"""
Centralized proxy URL builder.
Configure via environment variables:
  PROXY_SERVICE=scrapingant|zenrows|scraperapi|none  (default: scraperapi)
  SCRAPER_API_KEY=...     (ScraperAPI)
  SCRAPINGANT_API_KEY=... (ScrapingAnt)
  ZENROWS_API_KEY=...     (ZenRows)
"""
import os
import urllib.parse


def _get_service() -> str:
    return os.environ.get("PROXY_SERVICE", "scraperapi").lower()


def _get_key() -> str:
    service = _get_service()
    key_map = {
        "scraperapi":  os.environ.get("SCRAPER_API_KEY", os.environ.get("SCRAPERAPI_KEY", "")),
        "scrapingant": os.environ.get("SCRAPINGANT_API_KEY", os.environ.get("SCRAPINGANT_KEY", "")),
        "zenrows":     os.environ.get("ZENROWS_API_KEY", os.environ.get("ZENROWS_KEY", "")),
        "scrapingbee": os.environ.get("SCRAPINGBEE_API_KEY", os.environ.get("SCRAPINGBEE_KEY", "")),
    }
    return key_map.get(service, "")


def proxy_url(target: str, *, render_js: bool = False, session: int = 0) -> str | None:
    """
    Build a proxy URL for the target. Returns None if no proxy configured.
    The caller should fall back to direct request when None is returned.
    """
    service = _get_service()
    key = _get_key()

    if service == "none" or not key:
        return None

    encoded = urllib.parse.quote(target, safe="")

    if service == "scraperapi":
        url = f"http://api.scraperapi.com/?api_key={key}&url={encoded}&render={'true' if render_js else 'false'}"
        if session:
            url += f"&session_number={session}"
        return url

    if service == "scrapingant":
        # ScrapingAnt: https://api.scrapingant.com/v2/general?url=...&x-api-key=...
        url = f"https://api.scrapingant.com/v2/general?url={encoded}&x-api-key={key}"
        if render_js:
            url += "&browser=false"  # browser=true for JS render
        return url

    if service == "zenrows":
        # ZenRows: https://api.zenrows.com/v1/?apikey=...&url=...
        url = f"https://api.zenrows.com/v1/?apikey={key}&url={encoded}"
        if render_js:
            url += "&js_render=true"
        return url

    if service == "scrapingbee":
        # ScrapingBee: https://app.scrapingbee.com/api/v1/?api_key=...&url=...
        url = f"https://app.scrapingbee.com/api/v1/?api_key={key}&url={encoded}"
        if render_js:
            url += "&render_js=true"
        else:
            url += "&render_js=false"
        return url

    return None


def is_proxy_available() -> bool:
    return bool(_get_key()) and _get_service() != "none"
