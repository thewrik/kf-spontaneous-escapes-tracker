"""
Flight schedule fetcher.

Accepts a list of flight numbers and returns a dict mapping each flight number
to its schedule (dep, arr, dur).

Priority:
  1. AeroDataBox API via RapidAPI (if RAPIDAPI_KEY env var is set)
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
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

AERODATABOX_BASE = "https://aerodatabox.p.rapidapi.com/flights/number"
AERODATABOX_HOST = "aerodatabox.p.rapidapi.com"
DATA_JSON_PATH = Path(__file__).parent.parent / "data" / "flights.json"


def _parse_local_hhmm(time_str: str) -> Optional[str]:
    """Extract HH:MM from AeroDataBox local time like '2026-05-01 06:20+08:00'."""
    if not time_str:
        return None
    match = re.search(r"(\d{2}:\d{2})(?:[+-]\d{2}:\d{2}|Z)?$", time_str)
    if match:
        return match.group(1)
    match = re.search(r"\s(\d{2}:\d{2})", time_str)
    if match:
        return match.group(1)
    return None


def _parse_utc_dt(time_str: str) -> Optional[datetime]:
    """Parse AeroDataBox UTC time like '2026-05-01 22:20Z' into a datetime."""
    if not time_str:
        return None
    clean = time_str.replace("Z", "+00:00").strip()
    # '2026-05-01 22:20+00:00' → replace space with T for fromisoformat
    clean = re.sub(r"(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})", r"\1T\2", clean)
    try:
        return datetime.fromisoformat(clean)
    except ValueError:
        return None


def _calc_duration(dep_utc: str, arr_utc: str) -> str:
    """Calculate flight duration from two UTC time strings."""
    dep_dt = _parse_utc_dt(dep_utc)
    arr_dt = _parse_utc_dt(arr_utc)
    if not dep_dt or not arr_dt:
        return ""
    diff = arr_dt - dep_dt
    if diff.total_seconds() < 0:
        diff += timedelta(days=1)
    total_minutes = int(diff.total_seconds() / 60)
    return f"{total_minutes // 60}h {str(total_minutes % 60).zfill(2)}m"


def _fetch_from_aerodatabox(flight_numbers: list[str], api_key: str) -> dict[str, dict]:
    """
    Query AeroDataBox for each flight number.
    Returns a partial dict of flight_number → {dep, arr, dur}.

    dep/arr are local times at origin/destination airports (HH:MM).
    dur is calculated from UTC timestamps for accuracy.
    """
    results: dict[str, dict] = {}
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": AERODATABOX_HOST,
    }

    for fn in flight_numbers:
        url = f"{AERODATABOX_BASE}/{fn}"
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 404:
                logger.debug("AeroDataBox: no data for %s", fn)
                continue
            resp.raise_for_status()
            data = resp.json()

            # Response is a list of flights; take the first scheduled one
            flights = data if isinstance(data, list) else data.get("items", [])
            if not flights:
                logger.debug("AeroDataBox: empty response for %s", fn)
                continue

            flight = flights[0]
            dep_local = (
                flight.get("departure", {}).get("scheduledTime", {}).get("local") or
                flight.get("departure", {}).get("scheduledTime", {}).get("utc") or ""
            )
            arr_local = (
                flight.get("arrival", {}).get("scheduledTime", {}).get("local") or
                flight.get("arrival", {}).get("scheduledTime", {}).get("utc") or ""
            )
            dep_utc = flight.get("departure", {}).get("scheduledTime", {}).get("utc", "")
            arr_utc = flight.get("arrival", {}).get("scheduledTime", {}).get("utc", "")

            dep_hhmm = _parse_local_hhmm(dep_local)
            arr_hhmm = _parse_local_hhmm(arr_local)
            dur = _calc_duration(dep_utc, arr_utc)

            if dep_hhmm and arr_hhmm:
                results[fn] = {"dep": dep_hhmm, "arr": arr_hhmm, "dur": dur}
                logger.debug("AeroDataBox: %s %s→%s (%s)", fn, dep_hhmm, arr_hhmm, dur)
            else:
                logger.debug("AeroDataBox: incomplete times for %s", fn)

        except requests.RequestException as exc:
            logger.warning("AeroDataBox request failed for %s: %s", fn, exc)
        except Exception as exc:
            logger.warning("AeroDataBox parse error for %s: %s", fn, exc)
        finally:
            time.sleep(0.5)

    return results


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

    If RAPIDAPI_KEY is set, queries AeroDataBox for live schedule data.
    Unknown flights fall back to existing_schedules (or data/flights.json).

    Args:
        flight_numbers: List of IATA flight identifiers, e.g. ["SQ950", "TR282"].
        existing_schedules: Dict of flight_number → {dep, arr, dur} to use as
            fallback. If None, loaded from data/flights.json.

    Returns:
        Dict mapping every input flight number that has schedule data to
        {"dep": "HH:MM", "arr": "HH:MM", "dur": "Xh YYm"}.
        dep/arr are local times at origin/destination airports respectively.
    """
    if existing_schedules is None:
        existing_schedules = _load_existing_schedules()

    api_key = os.environ.get("RAPIDAPI_KEY", "").strip()

    if not api_key:
        logger.info(
            "RAPIDAPI_KEY not set — using existing schedules for %d flights",
            len(flight_numbers),
        )
        return {fn: existing_schedules[fn] for fn in flight_numbers if fn in existing_schedules}

    logger.info("Fetching schedules from AeroDataBox for %d flights", len(flight_numbers))
    api_results = _fetch_from_aerodatabox(flight_numbers, api_key)

    merged: dict[str, dict] = {}
    for fn in flight_numbers:
        if fn in api_results:
            merged[fn] = api_results[fn]
        elif fn in existing_schedules:
            merged[fn] = existing_schedules[fn]
        else:
            logger.debug("No schedule data for %s", fn)

    logger.info(
        "get_schedules: %d/%d resolved (%d from API, %d from fallback)",
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
