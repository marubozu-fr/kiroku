from typing import Any, Optional

from app.database import database

# Columns a client may write. Used to build UPDATE statements from a known
# allowlist so column identifiers never come from request data.
WRITABLE_COLUMNS = ("name", "description", "is_active")


async def get_all(active_only: bool = False) -> list[dict[str, Any]]:
  """Return all tags, optionally only the active ones, ordered by name."""
  query = "SELECT * FROM tags"
  if active_only:
    query += " WHERE is_active = 1"
  query += " ORDER BY name"
  rows = await database.fetch_all(query)
  return [dict(row) for row in rows]


async def get_by_id(tag_id: int) -> Optional[dict[str, Any]]:
  """Return a single tag by id, or None if it does not exist."""
  row = await database.fetch_one("SELECT * FROM tags WHERE id = :id", {"id": tag_id})
  return dict(row) if row is not None else None


async def get_by_name(name: str) -> Optional[dict[str, Any]]:
  """Return a single tag by exact name, or None if it does not exist."""
  row = await database.fetch_one("SELECT * FROM tags WHERE name = :name", {"name": name})
  return dict(row) if row is not None else None


async def create(name: str, description: Optional[str], now: str) -> int:
  """Insert a new tag and return its generated id."""
  query = """
    INSERT INTO tags (name, description, is_active, created_at, updated_at)
    VALUES (:name, :description, 1, :now, :now)
  """
  values = {"name": name, "description": description, "now": now}
  return await database.execute(query, values)


async def update(tag_id: int, fields: dict[str, Any], now: str) -> None:
  """Update the given writable columns of a tag."""
  set_clause = ", ".join(f"{column} = :{column}" for column in fields)
  query = f"UPDATE tags SET {set_clause}, updated_at = :updated_at WHERE id = :id"
  values = {**fields, "updated_at": now, "id": tag_id}
  await database.execute(query, values)


async def soft_delete(tag_id: int, now: str) -> None:
  """Mark a tag inactive without removing the row."""
  await database.execute(
    "UPDATE tags SET is_active = 0, updated_at = :now WHERE id = :id",
    {"now": now, "id": tag_id},
  )
