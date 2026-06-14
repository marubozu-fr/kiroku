from typing import Any, Optional

from app.database import database
from app.models.news_event import NewsEvent


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


async def load_for_period(start_date: str, end_date: str) -> list[NewsEvent]:
  """Load events whose UTC date falls within [start_date, end_date], ordered by date."""
  query = """
    SELECT * FROM news_events
    WHERE date >= :start_date AND date <= :end_date
    ORDER BY date
  """
  rows = await database.fetch_all(query, {"start_date": start_date, "end_date": end_date})
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
