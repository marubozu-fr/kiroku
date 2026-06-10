from typing import Any, Optional

from app.database import database

# Columns a client may write. Used to build UPDATE statements from a known
# allowlist so column identifiers never come from request data.
WRITABLE_COLUMNS = (
  "asset_id",
  "account_type",
  "status",
  "direction",
  "stop_loss",
  "notes",
  "missed_opportunity",
  "risk_per_trade",
  "avg_entry_price",
  "avg_exit_price",
  "risk",
  "reward",
  "performance_r",
  "timeframe_unit",
  "timeframe_value",
  "trade_date",
)


async def asset_exists(asset_id: int) -> bool:
  """Return True if an asset with the given id exists."""
  row = await database.fetch_one("SELECT id FROM assets WHERE id = :id", {"id": asset_id})
  return row is not None


async def tag_exists(tag_id: int) -> bool:
  """Return True if a tag with the given id exists."""
  row = await database.fetch_one("SELECT id FROM tags WHERE id = :id", {"id": tag_id})
  return row is not None


async def emotion_exists(emotion_id: int) -> bool:
  """Return True if an emotion with the given id exists."""
  row = await database.fetch_one("SELECT id FROM emotions WHERE id = :id", {"id": emotion_id})
  return row is not None


async def get_trade_by_id(trade_id: int) -> Optional[dict[str, Any]]:
  """Return a single trade row by id, or None if it does not exist."""
  row = await database.fetch_one("SELECT * FROM trades WHERE id = :id", {"id": trade_id})
  return dict(row) if row is not None else None


async def list_trades(
  year: Optional[int] = None,
  asset_id: Optional[int] = None,
  status: Optional[str] = None,
  direction: Optional[str] = None,
) -> list[dict[str, Any]]:
  """Return trade rows (scalar only) ordered by trade_date DESC, applying optional filters."""
  query = "SELECT * FROM trades WHERE 1=1"
  values: dict[str, Any] = {}
  if year is not None:
    query += " AND substr(trade_date, 1, 4) = :year"
    values["year"] = str(year)
  if asset_id is not None:
    query += " AND asset_id = :asset_id"
    values["asset_id"] = asset_id
  if status is not None:
    query += " AND status = :status"
    values["status"] = status
  if direction is not None:
    query += " AND direction = :direction"
    values["direction"] = direction
  query += " ORDER BY trade_date DESC"
  rows = await database.fetch_all(query, values)
  return [dict(row) for row in rows]


async def distinct_years() -> list[int]:
  """Return distinct years present in trade_date, descending."""
  rows = await database.fetch_all(
    "SELECT DISTINCT substr(trade_date, 1, 4) AS y FROM trades WHERE trade_date IS NOT NULL ORDER BY y DESC"
  )
  return [int(row["y"]) for row in rows]


async def insert_trade(fields: dict[str, Any], now: str) -> int:
  """Insert a new trade row and return its generated id."""
  cols = list(fields.keys())
  col_clause = ", ".join(cols) + ", created_at, updated_at"
  val_clause = ", ".join(f":{c}" for c in cols) + ", :now, :now"
  query = f"INSERT INTO trades ({col_clause}) VALUES ({val_clause})"
  return await database.execute(query, {**fields, "now": now})


async def update_trade(trade_id: int, fields: dict[str, Any], now: str) -> None:
  """Update the given writable columns of a trade."""
  set_clause = ", ".join(f"{col} = :{col}" for col in fields)
  query = f"UPDATE trades SET {set_clause}, updated_at = :updated_at WHERE id = :id"
  await database.execute(query, {**fields, "updated_at": now, "id": trade_id})


async def delete_trade(trade_id: int) -> None:
  """Permanently remove a trade row (children cascade via FK)."""
  await database.execute("DELETE FROM trades WHERE id = :id", {"id": trade_id})


async def insert_activity(trade_id: int, activity: dict[str, Any]) -> int:
  """Insert a single trade activity and return its id."""
  query = """
    INSERT INTO trade_activities (trade_id, type, price, quantity, date, is_entry)
    VALUES (:trade_id, :type, :price, :quantity, :date, :is_entry)
  """
  values = {
    "trade_id": trade_id,
    "type": activity["type"],
    "price": activity["price"],
    "quantity": activity["quantity"],
    "date": activity["date"],
    "is_entry": activity["is_entry"],
  }
  return await database.execute(query, values)


async def replace_activities(trade_id: int, activities: list[dict[str, Any]]) -> None:
  """Delete all activities for a trade, then insert the new list."""
  await database.execute("DELETE FROM trade_activities WHERE trade_id = :trade_id", {"trade_id": trade_id})
  for activity in activities:
    await insert_activity(trade_id, activity)


async def get_activities(trade_id: int) -> list[dict[str, Any]]:
  """Return all activities for a trade ordered by date ASC."""
  rows = await database.fetch_all(
    "SELECT * FROM trade_activities WHERE trade_id = :trade_id ORDER BY date ASC",
    {"trade_id": trade_id},
  )
  return [dict(row) for row in rows]


async def set_tags(trade_id: int, tag_ids: list[int]) -> None:
  """Replace all tag associations for a trade."""
  await database.execute("DELETE FROM trade_tags WHERE trade_id = :trade_id", {"trade_id": trade_id})
  for tag_id in tag_ids:
    await database.execute(
      "INSERT INTO trade_tags (trade_id, tag_id) VALUES (:trade_id, :tag_id)",
      {"trade_id": trade_id, "tag_id": tag_id},
    )


async def get_tags(trade_id: int) -> list[dict[str, Any]]:
  """Return full tag rows for a trade, ordered by name."""
  rows = await database.fetch_all(
    """
    SELECT t.* FROM tags t
    JOIN trade_tags tt ON tt.tag_id = t.id
    WHERE tt.trade_id = :trade_id
    ORDER BY t.name
    """,
    {"trade_id": trade_id},
  )
  return [dict(row) for row in rows]


async def set_emotions(trade_id: int, emotion_ids: list[int]) -> None:
  """Replace all emotion associations for a trade."""
  await database.execute("DELETE FROM trade_emotions WHERE trade_id = :trade_id", {"trade_id": trade_id})
  for emotion_id in emotion_ids:
    await database.execute(
      "INSERT INTO trade_emotions (trade_id, emotion_id) VALUES (:trade_id, :emotion_id)",
      {"trade_id": trade_id, "emotion_id": emotion_id},
    )


async def get_emotions(trade_id: int) -> list[dict[str, Any]]:
  """Return full emotion rows for a trade, ordered by name."""
  rows = await database.fetch_all(
    """
    SELECT e.* FROM emotions e
    JOIN trade_emotions te ON te.emotion_id = e.id
    WHERE te.trade_id = :trade_id
    ORDER BY e.name
    """,
    {"trade_id": trade_id},
  )
  return [dict(row) for row in rows]


async def get_screenshots(trade_id: int) -> list[dict[str, Any]]:
  """Return all screenshot records for a trade, ordered by created_at."""
  rows = await database.fetch_all(
    "SELECT * FROM trade_screenshots WHERE trade_id = :trade_id ORDER BY created_at",
    {"trade_id": trade_id},
  )
  return [dict(row) for row in rows]


async def insert_screenshot(
  trade_id: int,
  filename: str,
  timeframe_unit: str,
  timeframe_value: int,
  label: Optional[str],
  now: str,
) -> int:
  """Insert a single screenshot record and return its generated id."""
  query = """
    INSERT INTO trade_screenshots
      (trade_id, filename, timeframe_unit, timeframe_value, label, created_at)
    VALUES (:trade_id, :filename, :timeframe_unit, :timeframe_value, :label, :created_at)
  """
  values = {
    "trade_id": trade_id,
    "filename": filename,
    "timeframe_unit": timeframe_unit,
    "timeframe_value": timeframe_value,
    "label": label,
    "created_at": now,
  }
  return await database.execute(query, values)


async def get_screenshot_by_id(screenshot_id: int) -> Optional[dict[str, Any]]:
  """Return a single screenshot record by id, or None if it does not exist."""
  row = await database.fetch_one(
    "SELECT * FROM trade_screenshots WHERE id = :id", {"id": screenshot_id}
  )
  return dict(row) if row is not None else None


async def get_screenshot_by_filename(filename: str) -> Optional[dict[str, Any]]:
  """Return a single screenshot record by filename, or None if it does not exist."""
  row = await database.fetch_one(
    "SELECT * FROM trade_screenshots WHERE filename = :filename", {"filename": filename}
  )
  return dict(row) if row is not None else None


async def delete_screenshot(screenshot_id: int) -> None:
  """Permanently remove a screenshot record."""
  await database.execute("DELETE FROM trade_screenshots WHERE id = :id", {"id": screenshot_id})
