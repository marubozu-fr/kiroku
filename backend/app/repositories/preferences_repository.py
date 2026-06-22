import json
from typing import Any

from app.database import database

# Columns a client may write. Used to build UPDATE statements from a known
# allowlist so column identifiers never come from request data.
# last_backup_at is intentionally excluded: it is set internally by
# set_last_backup_at(), never directly by a client preferences update.
WRITABLE_COLUMNS = (
  "risk_per_trade_default",
  "news_enabled",
  "news_currencies",
  "news_min_impact",
  "backup_directory",
  "backup_reminder_days",
)

# Single-user app: preferences live in exactly one row, enforced by the
# CHECK (id = 1) constraint in schema.sql.
PREFERENCES_ID = 1


async def get() -> dict[str, Any]:
  """Return the single preferences row.

  The row is seeded by schema.sql on startup, so it always exists.
  `news_currencies` is stored as a JSON array string and decoded back to a list.
  """
  row = await database.fetch_one(
    "SELECT * FROM user_preferences WHERE id = :id", {"id": PREFERENCES_ID}
  )
  assert row is not None
  preferences = dict(row)
  preferences["news_currencies"] = json.loads(preferences["news_currencies"])
  return preferences


async def update(fields: dict[str, Any]) -> None:
  """Update the given writable columns of the preferences row."""
  values: dict[str, Any] = {**fields, "id": PREFERENCES_ID}
  # SQLite has no array type: persist the currency list as a JSON array string.
  if "news_currencies" in values:
    values["news_currencies"] = json.dumps(values["news_currencies"])
  set_clause = ", ".join(f"{column} = :{column}" for column in fields)
  query = f"UPDATE user_preferences SET {set_clause} WHERE id = :id"
  await database.execute(query, values)


async def set_last_backup_at(timestamp: str) -> None:
  """Record the ISO 8601 UTC timestamp of the most recent successful backup."""
  await database.execute(
    "UPDATE user_preferences SET last_backup_at = :ts WHERE id = :id",
    {"ts": timestamp, "id": PREFERENCES_ID},
  )
