from typing import Any, Optional

from app.database import database

# Columns a client may write. Used to build UPDATE statements from a known
# allowlist so column identifiers never come from request data.
WRITABLE_COLUMNS = ("name", "description", "severity", "category")


async def get_all(category: Optional[str] = None) -> list[dict[str, Any]]:
  """Return all emotions, optionally filtered by category, ordered by name."""
  query = "SELECT * FROM emotions"
  values: dict[str, Any] = {}
  if category is not None:
    query += " WHERE category = :category"
    values["category"] = category
  query += " ORDER BY name"
  rows = await database.fetch_all(query, values)
  return [dict(row) for row in rows]


async def get_by_id(emotion_id: int) -> Optional[dict[str, Any]]:
  """Return a single emotion by id, or None if it does not exist."""
  row = await database.fetch_one("SELECT * FROM emotions WHERE id = :id", {"id": emotion_id})
  return dict(row) if row is not None else None


async def create(
  name: str,
  description: Optional[str],
  severity: str,
  category: str,
  now: str,
) -> int:
  """Insert a new emotion and return its generated id."""
  query = """
    INSERT INTO emotions (name, description, severity, category, created_at, updated_at)
    VALUES (:name, :description, :severity, :category, :now, :now)
  """
  values = {
    "name": name,
    "description": description,
    "severity": severity,
    "category": category,
    "now": now,
  }
  return await database.execute(query, values)


async def update(emotion_id: int, fields: dict[str, Any], now: str) -> None:
  """Update the given writable columns of an emotion."""
  set_clause = ", ".join(f"{column} = :{column}" for column in fields)
  query = f"UPDATE emotions SET {set_clause}, updated_at = :updated_at WHERE id = :id"
  values = {**fields, "updated_at": now, "id": emotion_id}
  await database.execute(query, values)


async def count_trades(emotion_id: int) -> int:
  """Return how many trades reference this emotion."""
  row = await database.fetch_one(
    "SELECT COUNT(*) AS count FROM trade_emotions WHERE emotion_id = :id", {"id": emotion_id}
  )
  return row["count"] if row is not None else 0


async def delete(emotion_id: int) -> None:
  """Remove the emotion's trade associations, then delete the emotion row.

  `trade_emotions.emotion_id` has no ON DELETE CASCADE, so the associations
  must be cleared first or the foreign key constraint would block the delete.
  """
  await database.execute("DELETE FROM trade_emotions WHERE emotion_id = :id", {"id": emotion_id})
  await database.execute("DELETE FROM emotions WHERE id = :id", {"id": emotion_id})
