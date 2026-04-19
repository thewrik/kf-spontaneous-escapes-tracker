"""
Scoot (TR) KrisFlyer Spontaneous Escapes scraper.

Navigates to the Scoot KrisFlyer Spontaneous Escapes page, intercepts network
calls for any JSON API endpoints with route data, and falls back to HTML parsing.

Usage:
    from scoot_scraper import scrape_scoot
    routes = scrape_scoot()
"""

import json
import logging
import re
from typing import Any

from playwright.sync_api import sync_playwright, Page, Response

logger = logging.getLogger(__name__)

SCOOT_URL = "https://www.flyscoot.com/en/krisflyer/spontaneous-escapes"

# Scoot's KrisFlyer discount is 15%
DEFAULT_DISCOUNT = 15


def _parse_miles(text: str) -> int | None:
    """Extract integer miles from strings like '7,000 miles' or '7000 KF Miles'."""
    match = re.search(r"([\d,]+)\s*(?:KF\s*)?miles?", text, re.IGNORECASE)
    if match:
        return int(match.group(1).replace(",", ""))
    return None


def _parse_discount(text: str) -> int:
    match = re.search(r"(\d+)\s*%", text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return DEFAULT_DISCOUNT


def _parse_cabin(text: str) -> str:
    tl = text.lower()
    if "business" in tl or "scootbiz" in tl:
        return "Business"
    return "Economy"


def _parse_blackout_dates(text: str) -> list[str]:
    """
    Parse blackout date text like 'except 1, 3–5, 9 May 2026'.
    Returns sorted list of ISO date strings.
    """
    dates: list[str] = []
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
                dates.append(
                    f"{year}-{str(month).zfill(2)}-{str(single.group(1)).zfill(2)}"
                )

    return sorted(set(dates))


def _extract_routes_from_json(payload: Any) -> list[dict]:
    """
    Walk a JSON payload looking for route-like objects.
    Scoot's API might return a list of destination objects with miles + flight info.
    """
    routes: list[dict] = []

    def _walk(obj: Any, depth: int = 0) -> None:
        if depth > 8:
            return
        if isinstance(obj, list):
            for item in obj:
                _walk(item, depth + 1)
        elif isinstance(obj, dict):
            has_miles = any(
                k in obj
                for k in ("miles", "milesRequired", "mileage", "kfMiles", "award", "points")
            )
            has_dest = any(
                k in obj
                for k in ("destination", "to", "dest", "city", "iata", "port", "arrival")
            )
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
    """Convert a raw API dict into the standard route dict."""
    try:
        miles_raw = (
            obj.get("miles")
            or obj.get("milesRequired")
            or obj.get("mileage")
            or obj.get("kfMiles")
            or obj.get("points")
        )
        if miles_raw is None:
            award = obj.get("award", {})
            if isinstance(award, dict):
                miles_raw = award.get("miles") or award.get("points")
        if miles_raw is None:
            return None

        miles = int(str(miles_raw).replace(",", ""))

        from_city = (
            obj.get("origin")
            or obj.get("from")
            or obj.get("departure")
            or obj.get("source")
            or "Singapore"
        )
        to_city = (
            obj.get("destination")
            or obj.get("to")
            or obj.get("dest")
            or obj.get("city")
            or obj.get("arrival")
            or ""
        )
        if not to_city:
            return None

        cabin = _parse_cabin(str(obj.get("cabin", obj.get("class", "Economy"))))
        discount = _parse_discount(
            str(obj.get("discount", obj.get("saving", obj.get("off", f"{DEFAULT_DISCOUNT}%"))))
        )

        flights = obj.get("flights", obj.get("flightNumbers", obj.get("flightNo", [])))
        if isinstance(flights, str):
            flights = [flights]
        elif not isinstance(flights, list):
            flights = []

        blackout = obj.get("blackout", obj.get("blackoutDates", []))
        if isinstance(blackout, str):
            blackout = _parse_blackout_dates(blackout)

        return {
            "airline": "TR",
            "from": from_city,
            "to": to_city,
            "cabin": cabin,
            "miles": miles,
            "discount": discount,
            "flights": flights,
            "blackout": blackout,
        }
    except Exception as exc:
        logger.debug("Failed to normalise Scoot API route: %s — %s", obj, exc)
        return None


def _extract_routes_from_html(page: Page) -> list[dict]:
    """
    Parse Scoot's KrisFlyer Spontaneous Escapes page HTML.
    Scoot renders a table or card list with route, miles, and blackout dates.
    """
    routes: list[dict] = []

    # Try multiple selectors Scoot might use
    for selector in (
        ".krisflyer-escapes",
        ".escape-route",
        ".spontaneous-escape",
        ".deal-card",
        "table",
        ".route-row",
        "[class*='escape']",
        "[class*='route']",
        "[class*='krisflyer']",
    ):
        try:
            page.wait_for_selector(selector, timeout=6000)
            logger.info("Scoot: found selector '%s'", selector)
            break
        except Exception:
            continue

    # Grab candidate elements
    candidates = page.query_selector_all(
        "[class*='escape'], [class*='route'], [class*='deal'], [class*='krisflyer'], tr"
    )
    logger.info("Scoot: %d candidate elements found", len(candidates))

    for el in candidates:
        try:
            text = el.inner_text()
            if not text.strip():
                continue

            miles = _parse_miles(text)
            if not miles:
                continue

            # Route: "Singapore → Bangkok" or "SIN–BKK"
            arrow_match = re.search(
                r"([A-Za-z\s\(\)]+)\s*[→>–-]\s*([A-Za-z\s\(\)]+)", text
            )
            if not arrow_match:
                # Try IATA pair
                iata_match = re.search(r"\b([A-Z]{3})\s*[–-]\s*([A-Z]{3})\b", text)
                if iata_match:
                    from_city = iata_match.group(1)
                    to_city = iata_match.group(2)
                else:
                    continue
            else:
                from_city = arrow_match.group(1).strip()
                to_city = arrow_match.group(2).strip().split("\n")[0].strip()

            # Clean up city names
            for noise in ("Economy", "Business", "ScootBiz", "miles", "KF"):
                to_city = to_city.replace(noise, "").strip()

            cabin = _parse_cabin(text)
            discount = _parse_discount(text)

            # Flight numbers: TR followed by digits
            flights = list(dict.fromkeys(re.findall(r"\bTR\d{2,4}\b", text)))

            blackout_match = re.search(
                r"(?:except|blackout|not available on|excludes)[:\s]+([^\n]+)",
                text,
                re.IGNORECASE,
            )
            blackout = (
                _parse_blackout_dates(blackout_match.group(1)) if blackout_match else []
            )

            routes.append({
                "airline": "TR",
                "from": from_city,
                "to": to_city,
                "cabin": cabin,
                "miles": miles,
                "discount": discount,
                "flights": flights,
                "blackout": blackout,
            })
            logger.debug(
                "Scoot route extracted: %s → %s %s %d mi", from_city, to_city, cabin, miles
            )
        except Exception as exc:
            logger.debug("Error parsing Scoot element: %s", exc)

    return routes


def scrape_scoot() -> list[dict]:
    """
    Scrape Scoot KrisFlyer Spontaneous Escapes.

    Strategy:
      1. Launch Chromium headless.
      2. Intercept XHR/fetch JSON responses for relevant endpoints.
      3. If a useful API response is found, parse it.
      4. Otherwise parse the HTML.

    Returns list of route dicts:
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
        keywords = (
            "escape", "krisflyer", "miles", "flight", "promo", "route",
            "spontaneous", "award", "deal", "offer",
        )
        if not any(k in url.lower() for k in keywords):
            return
        try:
            body = response.json()
            found = _extract_routes_from_json(body)
            if found:
                logger.info("Scoot: found %d routes from API: %s", len(found), url)
                api_routes.extend(found)
                api_found = True
        except Exception as exc:
            logger.debug("Scoot: could not parse JSON from %s: %s", url, exc)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()
        page.on("response", handle_response)

        logger.info("Navigating to Scoot KrisFlyer Spontaneous Escapes page...")
        try:
            page.goto(SCOOT_URL, wait_until="networkidle", timeout=60000)
        except Exception as exc:
            logger.warning("Scoot page navigation warning: %s", exc)

        # Wait for JS rendering
        page.wait_for_timeout(4000)

        if api_found and api_routes:
            logger.info("Scoot: using API data (%d routes)", len(api_routes))
            html_routes: list[dict] = []
        else:
            logger.info("Scoot: no API data, falling back to HTML parsing")
            html_routes = _extract_routes_from_html(page)

        browser.close()

    result = api_routes if api_found else html_routes
    logger.info("scrape_scoot() returning %d routes", len(result))
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    routes = scrape_scoot()
    print(json.dumps(routes, indent=2))
