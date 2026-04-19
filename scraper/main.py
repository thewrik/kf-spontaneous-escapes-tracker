#!/usr/bin/env python3
"""
Run this script to update data/flights.json from the live promo pages.

Usage:
    python scraper/main.py                    # Update both SQ and TR
    python scraper/main.py --sq-only          # Update SQ only
    python scraper/main.py --scoot-only       # Update TR (Scoot) only
    python scraper/main.py --skip-schedules   # Skip AviationStack schedule fetch
    python scraper/main.py --sq-only --skip-schedules

The script:
  1. Scrapes SQ and/or Scoot promo pages.
  2. Falls back to existing data/flights.json routes if scraping returns nothing.
  3. Fetches (or falls back to) flight schedules.
  4. Merges everything into the flights.json structure.
  5. Updates meta.lastUpdated.
  6. Writes to data/flights.json.
  7. Prints a summary.
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# Ensure scraper/ is on the path regardless of cwd
SCRAPER_DIR = Path(__file__).parent
DATA_JSON = SCRAPER_DIR.parent / "data" / "flights.json"

sys.path.insert(0, str(SCRAPER_DIR))

from flight_times import get_schedules

logger = logging.getLogger(__name__)


# ─── Argument parsing ─────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update KrisFlyer Spontaneous Escapes data from live promo pages."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--sq-only",
        action="store_true",
        help="Only scrape Singapore Airlines (SQ) routes.",
    )
    group.add_argument(
        "--scoot-only",
        action="store_true",
        help="Only scrape Scoot (TR) routes.",
    )
    parser.add_argument(
        "--skip-schedules",
        action="store_true",
        help="Skip fetching updated flight schedules (faster).",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Log verbosity (default: INFO).",
    )
    return parser.parse_args()


# ─── Data helpers ─────────────────────────────────────────────────────────────

def load_existing() -> dict:
    """Load current data/flights.json, or return a minimal skeleton."""
    if DATA_JSON.exists():
        try:
            with open(DATA_JSON) as f:
                return json.load(f)
        except json.JSONDecodeError as exc:
            logger.warning("Could not parse existing flights.json: %s", exc)
    return {
        "meta": {
            "promotion": "KrisFlyer Spontaneous Escapes",
            "month": "May 2026",
            "bookBy": "2026-04-30",
            "lastUpdated": "",
            "sources": [
                "https://www.singaporeair.com/en_UK/sg/plan-travel/promotions/global/kf/kf-promo/kfescapes/",
                "https://www.flyscoot.com/en/krisflyer/spontaneous-escapes",
            ],
        },
        "iata": {},
        "schedules": {},
        "routes": [],
    }


def merge_routes(
    existing_routes: list[dict],
    new_routes: list[dict],
    airline: str,
) -> list[dict]:
    """
    Merge newly scraped routes with existing ones for a given airline.

    - Existing routes for other airlines are preserved as-is.
    - If new_routes is non-empty, they replace the existing routes for this airline.
    - If new_routes is empty (scraping failed), existing routes for this airline
      are preserved unchanged.
    """
    other_routes = [r for r in existing_routes if r.get("airline") != airline]

    if new_routes:
        logger.info(
            "Replacing %d existing %s routes with %d scraped routes",
            sum(1 for r in existing_routes if r.get("airline") == airline),
            airline,
            len(new_routes),
        )
        return other_routes + new_routes

    existing_airline_routes = [r for r in existing_routes if r.get("airline") == airline]
    logger.warning(
        "Scraping returned 0 %s routes — keeping %d existing routes",
        airline,
        len(existing_airline_routes),
    )
    return other_routes + existing_airline_routes


def collect_flight_numbers(routes: list[dict]) -> list[str]:
    """Return deduplicated sorted list of all flight numbers in routes."""
    seen: set[str] = set()
    for route in routes:
        for fn in route.get("flights", []):
            seen.add(fn)
    return sorted(seen)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    data = load_existing()
    existing_routes: list[dict] = data.get("routes", [])
    existing_schedules: dict = data.get("schedules", {})

    sq_scraped: list[dict] = []
    tr_scraped: list[dict] = []
    sq_source = "existing"
    tr_source = "existing"

    # ── SQ scraping ────────────────────────────────────────────────────────────
    if not args.scoot_only:
        logger.info("--- Scraping Singapore Airlines (SQ) ---")
        try:
            from sq_scraper import scrape_sq
            sq_scraped = scrape_sq()
            if sq_scraped:
                sq_source = "scraped"
                logger.info("SQ scraping succeeded: %d routes", len(sq_scraped))
            else:
                logger.warning("SQ scraping returned 0 routes — will keep existing data")
        except ImportError as exc:
            logger.error("Could not import sq_scraper: %s", exc)
        except Exception as exc:
            logger.error("SQ scraping failed: %s", exc, exc_info=True)

    # ── Scoot scraping ─────────────────────────────────────────────────────────
    if not args.sq_only:
        logger.info("--- Scraping Scoot (TR) ---")
        try:
            from scoot_scraper import scrape_scoot
            tr_scraped = scrape_scoot()
            if tr_scraped:
                tr_source = "scraped"
                logger.info("Scoot scraping succeeded: %d routes", len(tr_scraped))
            else:
                logger.warning("Scoot scraping returned 0 routes — will keep existing data")
        except ImportError as exc:
            logger.error("Could not import scoot_scraper: %s", exc)
        except Exception as exc:
            logger.error("Scoot scraping failed: %s", exc, exc_info=True)

    # ── Merge routes ───────────────────────────────────────────────────────────
    merged_routes = existing_routes

    if not args.scoot_only:
        merged_routes = merge_routes(merged_routes, sq_scraped, "SQ")

    if not args.sq_only:
        merged_routes = merge_routes(merged_routes, tr_scraped, "TR")

    # ── Flight schedules ───────────────────────────────────────────────────────
    if not args.skip_schedules:
        logger.info("--- Fetching flight schedules ---")
        all_flight_numbers = collect_flight_numbers(merged_routes)
        logger.info("Resolving schedules for %d unique flight numbers", len(all_flight_numbers))
        updated_schedules = get_schedules(all_flight_numbers, existing_schedules)
        # Preserve any existing schedules not covered by current routes
        final_schedules = {**existing_schedules, **updated_schedules}
        logger.info("Schedules resolved: %d entries", len(final_schedules))
    else:
        logger.info("Skipping schedule fetch (--skip-schedules)")
        final_schedules = existing_schedules

    # ── Write output ───────────────────────────────────────────────────────────
    data["routes"] = merged_routes
    data["schedules"] = final_schedules
    data["meta"]["lastUpdated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    DATA_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_JSON, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    logger.info("Wrote updated data to %s", DATA_JSON)

    # ── Summary ────────────────────────────────────────────────────────────────
    sq_count = sum(1 for r in merged_routes if r.get("airline") == "SQ")
    tr_count = sum(1 for r in merged_routes if r.get("airline") == "TR")
    total = len(merged_routes)

    print("\n" + "=" * 50)
    print("KrisFlyer Spontaneous Escapes — Update Summary")
    print("=" * 50)
    print(f"  SQ routes : {sq_count:>4}  ({sq_source})")
    print(f"  TR routes : {tr_count:>4}  ({tr_source})")
    print(f"  Total     : {total:>4}")
    print(f"  Schedules : {len(final_schedules):>4} entries")
    print(f"  Updated   : {data['meta']['lastUpdated']}")
    print(f"  Output    : {DATA_JSON}")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
