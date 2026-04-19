"""
SQ KrisFlyer Spontaneous Escapes scraper.

Navigates to the SQ KrisFlyer Escapes promo page, intercepts network calls to
detect any JSON API responses, and falls back to HTML parsing if no API is found.

Usage:
    from sq_scraper import scrape_sq
    routes = scrape_sq()
"""

import json
import logging
import re
from typing import Any

from playwright.sync_api import sync_playwright, Page, Response

logger = logging.getLogger(__name__)

SQ_URL = "https://www.singaporeair.com/en_UK/sg/plan-travel/promotions/global/kf/kf-promo/kfescapes/"

# Known cabin keywords on the page
CABIN_KEYWORDS = {"economy", "business", "first"}


def _parse_miles(text: str) -> int | None:
    """Extract an integer mile count from a string like '5,600 miles' or '9000KF miles'."""
    match = re.search(r"([\d,]+)\s*(?:miles?|KF)", text, re.IGNORECASE)
    if match:
        return int(match.group(1).replace(",", ""))
    return None


def _parse_discount(text: str) -> int:
    """Extract a discount percentage from a string like '30% off'."""
    match = re.search(r"(\d+)\s*%", text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return 30  # SQ default


def _parse_cabin(text: str) -> str:
    tl = text.lower()
    if "business" in tl:
        return "Business"
    if "first" in tl:
        return "First"
    return "Economy"


def _parse_blackout_dates(text: str) -> list[str]:
    """
    Try to parse blackout date strings like '1, 3-5, 9 May 2026' into ISO dates.
    Returns a list of 'YYYY-MM-DD' strings.
    """
    dates: list[str] = []
    # Simple heuristic: look for patterns like '1 May 2026' or '3-5 May'
    month_match = re.search(r"(\w+)\s+(\d{4})", text)
    if not month_match:
        return dates

    month_name = month_match.group(1)
    year = int(month_match.group(2))

    month_map = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    month = month_map.get(month_name.lower()[:3])
    if not month:
        return dates

    # Find all day ranges / single days before the month name
    pre_text = text[: month_match.start()]
    parts = [p.strip() for p in re.split(r"[,;]", pre_text) if p.strip()]
    for part in parts:
        range_match = re.match(r"(\d+)\s*[-–]\s*(\d+)", part)
        if range_match:
            start_d, end_d = int(range_match.group(1)), int(range_match.group(2))
            for d in range(start_d, end_d + 1):
                dates.append(f"{year}-{str(month).zfill(2)}-{str(d).zfill(2)}")
        else:
            single = re.match(r"(\d+)", part)
            if single:
                dates.append(f"{year}-{str(month).zfill(2)}-{str(single.group(1)).zfill(2)}")

    return sorted(set(dates))


def _extract_routes_from_json(payload: dict) -> list[dict]:
    """
    Attempt to extract route records from a JSON API payload.
    SQ's API structure is unknown; we look for common patterns.
    """
    routes: list[dict] = []

    def _walk(obj: Any, depth: int = 0) -> None:
        if depth > 8:
            return
        if isinstance(obj, list):
            for item in obj:
                _walk(item, depth + 1)
        elif isinstance(obj, dict):
            # Heuristic: a route object typically has 'miles'/'milesRequired' and a destination
            has_miles = any(k in obj for k in ("miles", "milesRequired", "mileage", "award"))
            has_dest = any(k in obj for k in ("destination", "to", "dest", "city", "port"))
            if has_miles and has_dest:
                route = _normalise_api_route(obj)
                if route:
                    routes.append(route)
            else:
                for v in obj.values():
                    _walk(v, depth + 1)

    _walk(payload)
    return routes


def _normalise_api_route(obj: dict) -> dict | None:
    """Convert an API object into the standard route dict."""
    try:
        miles = (
            obj.get("miles")
            or obj.get("milesRequired")
            or obj.get("mileage")
            or obj.get("award", {}).get("miles")
        )
        if miles is None:
            return None
        miles = int(str(miles).replace(",", ""))

        from_city = (
            obj.get("origin") or obj.get("from") or obj.get("departure") or "Singapore"
        )
        to_city = (
            obj.get("destination") or obj.get("to") or obj.get("dest") or obj.get("city") or ""
        )
        if not to_city:
            return None

        cabin = _parse_cabin(str(obj.get("cabin", obj.get("class", "Economy"))))
        discount = _parse_discount(str(obj.get("discount", obj.get("saving", "30%"))))
        flights = obj.get("flights", obj.get("flightNumbers", obj.get("flightNo", [])))
        if isinstance(flights, str):
            flights = [flights]

        blackout = obj.get("blackout", obj.get("blackoutDates", []))
        if isinstance(blackout, str):
            blackout = _parse_blackout_dates(blackout)

        return {
            "airline": "SQ",
            "from": from_city,
            "to": to_city,
            "cabin": cabin,
            "miles": miles,
            "discount": discount,
            "flights": flights,
            "blackout": blackout,
        }
    except Exception as exc:
        logger.debug("Failed to normalise API route: %s — %s", obj, exc)
        return None


def _extract_routes_from_html(page: Page) -> list[dict]:
    """
    Parse route cards from the SQ KrisFlyer Escapes HTML page.
    The page renders promotion cards; we look for the route/miles/cabin text.
    """
    routes: list[dict] = []

    # Wait for the promo cards to appear — SQ typically uses a '.promo-card' or
    # '.kf-escape-card' or '.award-table' selector; we try several.
    for selector in (".kf-escape", ".promo-card", ".award-row", "table", ".route-item"):
        try:
            page.wait_for_selector(selector, timeout=8000)
            logger.info("Found selector: %s", selector)
            break
        except Exception:
            continue

    # Grab all text blocks that look like route info
    # Pattern: "Singapore → Bali\nEconomy\n9,000 miles\n30% off\nSQ950, SQ962"
    cards = page.query_selector_all("[class*='escape'], [class*='route'], [class*='award'], [class*='promo']")
    logger.info("Found %d candidate card elements", len(cards))

    for card in cards:
        try:
            text = card.inner_text()
            if not text.strip():
                continue

            miles = _parse_miles(text)
            if not miles:
                continue

            # Try to extract origin → destination
            arrow_match = re.search(r"([A-Za-z\s\(\)]+)\s*[→>–-]\s*([A-Za-z\s\(\)]+)", text)
            if not arrow_match:
                continue

            from_city = arrow_match.group(1).strip()
            to_city = arrow_match.group(2).strip().split("\n")[0].strip()

            cabin = _parse_cabin(text)
            discount = _parse_discount(text)

            # Flight numbers: SQ followed by digits
            flights = list(dict.fromkeys(re.findall(r"\bSQ\d{2,4}\b", text)))

            # Blackout text: look for "except", "not available", "blackout"
            blackout_match = re.search(
                r"(?:except|blackout|not available on)[:\s]+([^\n]+)", text, re.IGNORECASE
            )
            blackout = _parse_blackout_dates(blackout_match.group(1)) if blackout_match else []

            routes.append({
                "airline": "SQ",
                "from": from_city,
                "to": to_city,
                "cabin": cabin,
                "miles": miles,
                "discount": discount,
                "flights": flights,
                "blackout": blackout,
            })
            logger.debug("Extracted route: %s → %s %s %d mi", from_city, to_city, cabin, miles)
        except Exception as exc:
            logger.debug("Error parsing card: %s", exc)

    return routes


def scrape_sq() -> list[dict]:
    """
    Scrape SQ KrisFlyer Spontaneous Escapes.

    Strategy:
      1. Launch Chromium with Playwright.
      2. Intercept XHR/fetch responses looking for a JSON API endpoint.
      3. If a relevant API response is found, extract routes from JSON.
      4. Otherwise fall back to HTML parsing.

    Returns a list of route dicts with keys:
        airline, from, to, cabin, miles, discount, flights, blackout
    """
    api_routes: list[dict] = []
    api_found = False

    def handle_response(response: Response) -> None:
        nonlocal api_found
        if api_found:
            return
        ct = response.headers.get("content-type", "")
        url = response.url
        if "json" not in ct:
            return
        # Look for endpoints that are likely to contain escape/award data
        keywords = ("escape", "award", "kfpromo", "miles", "flight", "promo", "route")
        if not any(k in url.lower() for k in keywords):
            return
        try:
            body = response.json()
            found = _extract_routes_from_json(body)
            if found:
                logger.info("Found %d routes from API: %s", len(found), url)
                api_routes.extend(found)
                api_found = True
        except Exception as exc:
            logger.debug("Could not parse JSON from %s: %s", url, exc)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()
        page.on("response", handle_response)

        logger.info("Navigating to SQ KrisFlyer Escapes page...")
        try:
            page.goto(SQ_URL, wait_until="networkidle", timeout=60000)
        except Exception as exc:
            logger.warning("Page navigation warning: %s", exc)

        # Give extra time for lazy-loaded content / JS rendering
        page.wait_for_timeout(3000)

        if api_found and api_routes:
            logger.info("Using API data: %d routes", len(api_routes))
            html_routes = []
        else:
            logger.info("No API data found, falling back to HTML parsing")
            html_routes = _extract_routes_from_html(page)

        browser.close()

    result = api_routes if api_found else html_routes
    logger.info("scrape_sq() returning %d routes", len(result))
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    routes = scrape_sq()
    print(json.dumps(routes, indent=2))
