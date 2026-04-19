"""
Flight schedule fetcher.

Accepts a list of flight numbers and returns a dict mapping each flight number
to its schedule (dep, arr, dur).

Priority:
  1. AviationStack API (if AVIATIONSTACK_API_KEY env var is set)
  2. Fall back to existing schedules from data/flights.json

Usage:
    from flight_times import get_schedules

    existing = data["schedules"]   # from flights.json
    updated = get_schedules(["SQ950", "TR282"], existing)
"""

import json
import logging
import os
import re
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

AVIATIONSTACK_BASE = "http://api.aviationstack.com/v1/flights"
DATA_JSON_PATH = Path(__file__).parent.parent / "data" / "flights.json"


def _fetch_from_aviationstack(
    flight_numbers: list[str], api_key: str
) -> dict[str, dict]:
    """
    Query AviationStack for each flight number (free tier: one at a time).
    Returns a partial dict of flight_number → {dep, arr, dur}.
    """
    results: dict[str, dict] = {}

    for fn in flight_numbers:
        # AviationStack uses airline IATA + flight number, e.g. 'SQ950'
        airline_iata = re.match(r"^([A-Z]{2})", fn)
        if not airline_iata:
            continue
        params = {
            "access_key": api_key,
            "flight_iata": fn,
            "limit": 1,
        }
        try:
            resp = requests.get(AVIATIONSTACK_BASE, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            flights = data.get("data", [])
            if not flights:
                logger.debug("AviationStack: no data for %s", fn)
                continue

            flight = flights[0]
            dep_time = (
                flight.get("departure", {}).get("scheduled") or
                flight.get("departure", {}).get("estimated") or ""
            )
            arr_time = (
                flight.get("arrival", {}).get("scheduled") or
                flight.get("arrival", {}).get("estimated") or ""
            )

            # Convert ISO 8601 → "HH:MM"
            dep_hhmm = _iso_to_hhmm(dep_time)
            arr_hhmm = _iso_to_hhmm(arr_time)
            dur = _calc_duration(dep_time, arr_time)

            if dep_hhmm and arr_hhmm:
                results[fn] = {"dep": dep_hhmm, "arr": arr_hhmm, "dur": dur}
                logger.debug("AviationStack: got schedule for %s: %s→%s", fn, dep_hhmm, arr_hhmm)
            else:
                logger.debug("AviationStack: incomplete times for %s", fn)
        except requests.RequestException as exc:
            logger.warning("AviationStack request failed for %s: %s", fn, exc)
        except Exception as exc:
            logger.warning("AviationStack parse error for %s: %s", fn, exc)

    return results


def _iso_to_hhmm(iso: str) -> Optional[str]:
    """Convert ISO 8601 datetime string to 'HH:MM'."""
    if not iso:
        return None
    match = re.search(r"T(\d{2}:\d{2})", iso)
    if match:
        return match.group(1)
    # Try bare time
    match = re.search(r"(\d{2}:\d{2})", iso)
    if match:
        return match.group(1)
    return None


def _calc_duration(dep_iso: str, arr_iso: str) -> str:
    """Calculate flight duration from two ISO timestamps."""
    try:
        from datetime import datetime, timezone
        fmt = "%Y-%m-%dT%H:%M:%S%z"
        # Remove sub-seconds
        dep_clean = re.sub(r"\.\d+", "", dep_iso)
        arr_clean = re.sub(r"\.\d+", "", arr_iso)
        dep_dt = datetime.fromisoformat(dep_clean)
        arr_dt = datetime.fromisoformat(arr_clean)
        diff = arr_dt - dep_dt
        total_minutes = int(diff.total_seconds() / 60)
        if total_minutes < 0:
            total_minutes += 24 * 60  # next-day arrival
        hours = total_minutes // 60
        mins = total_minutes % 60
        return f"{hours}h {str(mins).zfill(2)}m"
    except Exception:
        return ""


def _load_existing_schedules() -> dict[str, dict]:
    """Load the schedules dict from data/flights.json."""
    try:
        with open(DATA_JSON_PATH) as f:
            data = json.load(f)
        return data.get("schedules", {})
    except FileNotFoundError:
        logger.warning("data/flights.json not found; no fallback schedules available.")
        return {}
    except json.JSONDecodeError as exc:
        logger.warning("Failed to parse data/flights.json: %s", exc)
        return {}


def get_schedules(
    flight_numbers: list[str],
    existing_schedules: Optional[dict[str, dict]] = None,
) -> dict[str, dict]:
    """
    Return flight schedules for the given flight numbers.

    If AVIATIONSTACK_API_KEY is set as an environment variable, queries the
    AviationStack API for live schedule data. Unknown flights fall back to the
    existing_schedules dict (or data/flights.json if existing_schedules is None).

    Args:
        flight_numbers: List of IATA flight identifiers, e.g. ["SQ950", "TR282"].
        existing_schedules: Dict of flight_number → {dep, arr, dur} to use as
            fallback. If None, loaded from data/flights.json.

    Returns:
        Dict mapping every input flight number that has schedule data to
        {"dep": "HH:MM", "arr": "HH:MM", "dur": "Xh YYm"}.
    """
    if existing_schedules is None:
        existing_schedules = _load_existing_schedules()

    api_key = os.environ.get("AVIATIONSTACK_API_KEY", "").strip()

    if not api_key:
        logger.info(
            "AVIATIONSTACK_API_KEY not set — using existing schedules for %d flights",
            len(flight_numbers),
        )
        return {fn: existing_schedules[fn] for fn in flight_numbers if fn in existing_schedules}

    logger.info("Fetching schedules from AviationStack for %d flights", len(flight_numbers))
    api_results = _fetch_from_aviationstack(flight_numbers, api_key)

    # Merge: API results take precedence, fall back to existing
    merged: dict[str, dict] = {}
    for fn in flight_numbers:
        if fn in api_results:
            merged[fn] = api_results[fn]
        elif fn in existing_schedules:
            merged[fn] = existing_schedules[fn]
        else:
            logger.debug("No schedule data for %s", fn)

    logger.info(
        "get_schedules: %d/%d flights resolved (%d from API, %d from fallback)",
        len(merged),
        len(flight_numbers),
        len(api_results),
        len(merged) - len(api_results),
    )
    return merged


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    test_flights = ["SQ950", "SQ962", "TR502", "TR282"]
    schedules = get_schedules(test_flights)
    print(json.dumps(schedules, indent=2))
