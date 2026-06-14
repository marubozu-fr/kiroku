import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from app.database import database
from app.models.news_event import NewsEvent
from app.repositories import news_repository

logger = logging.getLogger(__name__)

# Free Forex Factory feed for the current week. No API key; rate-limited to
# 2 requests per 5 minutes, so callers should respect is_sync_stale().
FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
FEED_TIMEOUT_SECONDS = 10.0

# Maps the feed's free-text impact label to our normalized levels. Anything not
# listed (including "Holiday" and unknown values) falls back to "NONE".
_IMPACT_MAP = {
  "High": "HIGH",
  "Medium": "MEDIUM",
  "Low": "LOW",
  "Holiday": "NONE",
}

def _now() -> str:
  """Current UTC time as an ISO 8601 string."""
  return datetime.now(timezone.utc).isoformat()


def _map_impact(raw: Optional[str]) -> str:
  """Normalize a feed impact label to HIGH/MEDIUM/LOW/NONE."""
  return _IMPACT_MAP.get(raw or "", "NONE")


def _to_utc_iso(raw_date: str) -> str:
  """Parse a feed date (with timezone offset) and return it as a UTC ISO string."""
  parsed = datetime.fromisoformat(raw_date)
  return parsed.astimezone(timezone.utc).isoformat()


def _event_id(title: str, date_utc: str) -> str:
  """Deterministic 16-char id from sha256(title + date_utc) for idempotent upserts."""
  digest = hashlib.sha256(f"{title}{date_utc}".encode()).hexdigest()
  return digest[:16]


def _week_bounds(dates_utc: list[str]) -> tuple[str, str]:
  """Return (Monday 00:00 UTC, Sunday 23:59:59 UTC) for the week of the earliest date."""
  earliest = min(datetime.fromisoformat(d) for d in dates_utc)
  monday = (earliest - timedelta(days=earliest.weekday())).replace(
    hour=0, minute=0, second=0, microsecond=0
  )
  sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
  return monday.isoformat(), sunday.isoformat()


def _parse_event(raw: dict[str, Any], synced_at: str) -> NewsEvent:
  """Convert one raw feed entry into a NewsEvent (UTC date, normalized impact)."""
  date_utc = _to_utc_iso(raw["date"])
  title = raw["title"]
  return NewsEvent(
    id=_event_id(title, date_utc),
    date=date_utc,
    title=title,
    currency=raw["country"],
    impact=_map_impact(raw.get("impact")),
    forecast=raw.get("forecast") or "",
    previous=raw.get("previous") or "",
    synced_at=synced_at,
  )


async def sync_current_week() -> dict[str, Any]:
  """Fetch the current-week feed and replace this week's stored events.

  Uses a delete-then-insert strategy over the feed's week range so that events
  cancelled or rescheduled out of the feed also disappear from the database.
  Returns a dict with `synced`, `week_start`, and `week_end`.
  """
  logger.info("Starting news sync from %s", FEED_URL)
  try:
    async with httpx.AsyncClient(timeout=FEED_TIMEOUT_SECONDS) as client:
      response = await client.get(FEED_URL)
      response.raise_for_status()
      raw_events = response.json()
  except (httpx.HTTPError, ValueError) as exc:
    logger.warning("News feed fetch failed: %s", exc)
    raise

  synced_at = _now()
  events = [_parse_event(raw, synced_at) for raw in raw_events]

  if not events:
    logger.info("News sync complete: feed returned no events")
    return {"synced": 0, "week_start": None, "week_end": None}

  week_start, week_end = _week_bounds([event.date for event in events])
  async with database.transaction():
    await news_repository.delete_for_period(week_start, week_end)
    saved = await news_repository.save_events(events)

  logger.info(
    "News sync complete: %d events for week %s to %s", saved, week_start, week_end
  )
  return {"synced": saved, "week_start": week_start, "week_end": week_end}


async def load_news_for_period(
  start_date: str,
  end_date: str,
  currencies: Optional[list[str]] = None,
  min_impact: Optional[str] = None,
) -> list[NewsEvent]:
  """Load events in a date range, optionally filtered by currency and min impact."""
  return await news_repository.load_for_period(start_date, end_date, currencies, min_impact)


async def is_sync_stale(max_age_hours: int = 12) -> bool:
  """Return True if the last sync is older than max_age_hours, or never happened."""
  last_sync = await news_repository.get_last_sync_time()
  if last_sync is None:
    return True
  last = datetime.fromisoformat(last_sync)
  return datetime.now(timezone.utc) - last > timedelta(hours=max_age_hours)
