from typing import Any

from app.database import database

# Columns a client may write. Used to build UPDATE statements from a known
# allowlist so column identifiers never come from request data.
WRITABLE_COLUMNS = ("risk_per_trade_default",)

# Single-user app: preferences live in exactly one row, enforced by the
# CHECK (id = 1) constraint in schema.sql.
PREFERENCES_ID = 1


async def get() -> dict[str, Any]:
  """Return the single preferences row.

  The row is seeded by schema.sql on startup, so it always exists.
  """
  row = await database.fetch_one(
    "SELECT * FROM user_preferences WHERE id = :id", {"id": PREFERENCES_ID}
  )
  assert row is not None
  return dict(row)


async def update(fields: dict[str, Any]) -> None:
  """Update the given writable columns of the preferences row."""
  set_clause = ", ".join(f"{column} = :{column}" for column in fields)
  query = f"UPDATE user_preferences SET {set_clause} WHERE id = :id"
  values = {**fields, "id": PREFERENCES_ID}
  await database.execute(query, values)
