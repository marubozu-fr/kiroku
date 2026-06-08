from typing import Any, Optional

from app.database import database

# Columns a client may write. Used to build UPDATE statements from a known
# allowlist so column identifiers never come from request data.
WRITABLE_COLUMNS = ("name", "category", "currency", "is_active")


async def get_all(active_only: bool = False) -> list[dict[str, Any]]:
  """Return all assets, optionally only the active ones, ordered by name."""
  query = "SELECT * FROM assets"
  if active_only:
    query += " WHERE is_active = 1"
  query += " ORDER BY name"
  rows = await database.fetch_all(query)
  return [dict(row) for row in rows]


async def get_by_id(asset_id: int) -> Optional[dict[str, Any]]:
  """Return a single asset by id, or None if it does not exist."""
  row = await database.fetch_one(
    "SELECT * FROM assets WHERE id = :id", {"id": asset_id}
  )
  return dict(row) if row is not None else None


async def get_by_name(name: str) -> Optional[dict[str, Any]]:
  """Return a single asset by exact name, or None if it does not exist."""
  row = await database.fetch_one(
    "SELECT * FROM assets WHERE name = :name", {"name": name}
  )
  return dict(row) if row is not None else None


async def create(
  name: str, category: str, currency: Optional[str], now: str
) -> int:
  """Insert a new asset and return its generated id."""
  query = """
    INSERT INTO assets (name, category, currency, is_active, created_at, updated_at)
    VALUES (:name, :category, :currency, 1, :now, :now)
  """
  values = {"name": name, "category": category, "currency": currency, "now": now}
  return await database.execute(query, values)


async def update(asset_id: int, fields: dict[str, Any], now: str) -> None:
  """Update the given writable columns of an asset."""
  set_clause = ", ".join(f"{column} = :{column}" for column in fields)
  query = (
    f"UPDATE assets SET {set_clause}, updated_at = :updated_at WHERE id = :id"
  )
  values = {**fields, "updated_at": now, "id": asset_id}
  await database.execute(query, values)


async def soft_delete(asset_id: int, now: str) -> None:
  """Mark an asset inactive without removing the row."""
  await database.execute(
    "UPDATE assets SET is_active = 0, updated_at = :now WHERE id = :id",
    {"now": now, "id": asset_id},
  )
