from typing import Any, Optional

from app.database import database
from app.models.news_event import NewsEvent

# Impact ranking used by min_impact filtering (higher number = stronger impact).
IMPACT_RANK = {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "NONE": 0}


async def save_events(events: list[NewsEvent]) -> int:
  """Upsert events by primary key (INSERT OR REPLACE). Return the count saved."""
  query = """
    INSERT OR REPLACE INTO news_events
      (id, date, title, currency, impact, forecast, previous, synced_at)
    VALUES
      (:id, :date, :title, :currency, :impact, :forecast, :previous, :synced_at)
  """
  count = 0
  for event in events:
    await database.execute(query, event.model_dump())
    count += 1
  return count


async def load_for_period(
  start_date: str,
  end_date: str,
  currencies: Optional[list[str]] = None,
  min_impact: Optional[str] = None,
) -> list[NewsEvent]:
  """Load events in [start_date, end_date], optionally filtered by currency and min impact."""
  query = "SELECT * FROM news_events WHERE date >= :start_date AND date <= :end_date"
  params: dict[str, Any] = {"start_date": start_date, "end_date": end_date}

  if currencies:
    placeholders = ", ".join(f":c_{i}" for i in range(len(currencies)))
    query += f" AND currency IN ({placeholders})"
    for i, currency in enumerate(currencies):
      params[f"c_{i}"] = currency

  if min_impact:
    threshold = IMPACT_RANK.get(min_impact, 0)
    levels = [level for level, rank in IMPACT_RANK.items() if rank >= threshold]
    placeholders = ", ".join(f":imp_{i}" for i in range(len(levels)))
    query += f" AND impact IN ({placeholders})"
    for i, level in enumerate(levels):
      params[f"imp_{i}"] = level

  query += " ORDER BY date"
  rows = await database.fetch_all(query, params)
  return [NewsEvent(**dict(row)) for row in rows]


async def delete_for_period(start_date: str, end_date: str) -> int:
  """Delete events within [start_date, end_date]. Return the count deleted."""
  count_query = """
    SELECT COUNT(*) AS count FROM news_events
    WHERE date >= :start_date AND date <= :end_date
  """
  values: dict[str, Any] = {"start_date": start_date, "end_date": end_date}
  row = await database.fetch_one(count_query, values)
  deleted = row["count"] if row is not None else 0
  await database.execute(
    "DELETE FROM news_events WHERE date >= :start_date AND date <= :end_date", values
  )
  return deleted


async def get_last_sync_time() -> Optional[str]:
  """Return the most recent `synced_at` value, or None if no events exist."""
  row = await database.fetch_one("SELECT MAX(synced_at) AS last_sync FROM news_events")
  return row["last_sync"] if row is not None else None
