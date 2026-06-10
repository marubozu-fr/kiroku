import os
from pathlib import Path

import aiosqlite
from databases import Database

# SQLite file lives in backend/data/kiroku.db, created on first run (gitignored).
# KIROKU_DB_PATH overrides the location (used by the test suite for isolation).
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = Path(os.environ.get("KIROKU_DB_PATH", DATA_DIR / "kiroku.db"))
# Uploaded trade screenshots live under data/screenshots/{trade_id}/. Derived
# from the database location so the test suite's throwaway db keeps its files
# isolated too.
SCREENSHOTS_DIR = DB_PATH.parent / "screenshots"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

database = Database(DATABASE_URL)


async def apply_schema() -> None:
  """Create any missing tables by executing schema.sql.

  schema.sql uses `CREATE TABLE IF NOT EXISTS`, so this is a no-op once the
  tables already exist and is safe to run on every startup.
  """
  schema = SCHEMA_PATH.read_text()
  async with aiosqlite.connect(DB_PATH) as connection:
    await connection.execute("PRAGMA foreign_keys = ON")
    await connection.executescript(schema)
    await connection.commit()


async def apply_migrations() -> None:
  """Apply incremental column changes to databases created before they existed.

  schema.sql only creates missing tables; it never alters existing ones. New
  columns added to an existing table must be back-filled here so a database
  created by an earlier version stays in sync without a migration framework.
  Each step is guarded by a column-presence check, so this is a no-op once the
  database is current and is safe to run on every startup.
  """
  async with aiosqlite.connect(DB_PATH) as connection:
    await connection.execute("PRAGMA foreign_keys = ON")
    cursor = await connection.execute("PRAGMA table_info(trades)")
    columns = {row[1] for row in await cursor.fetchall()}

    # realized_pnl (issue #54): drop the stored monetary P&L column. It was
    # computed as reward × exit quantity (price units × raw qty), which is
    # meaningless for forex (1.0 lot = 100,000 units) and misleading for indices
    # without broker account data. P&L is now expressed only in R-multiples
    # (performance_r) and as a percentage (performance_r × risk_per_trade).
    if "realized_pnl" in columns:
      await connection.execute("ALTER TABLE trades DROP COLUMN realized_pnl")

    # account_type (issue #48): single account-type enum (test/demo/live)
    # replacing the never-implemented multi-select `types` array. Existing rows
    # have no account-type data to migrate, so the NOT NULL DEFAULT back-fills
    # them all to 'live' — the intended fallback.
    if "account_type" not in columns:
      await connection.execute(
        "ALTER TABLE trades ADD COLUMN account_type TEXT NOT NULL DEFAULT 'live'"
      )

    # label (issue #56): optional free-text annotation per screenshot (e.g.
    # "Setup confirmation", "Entry point"). Nullable, so existing rows need no
    # back-fill. Timeframe stays nullable in the schema for older rows; new
    # uploads require it at the API layer. Guarded by a table-presence check so
    # it is a no-op on databases that predate trade_screenshots.
    cursor = await connection.execute(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'trade_screenshots'"
    )
    if await cursor.fetchone() is not None:
      cursor = await connection.execute("PRAGMA table_info(trade_screenshots)")
      screenshot_columns = {row[1] for row in await cursor.fetchall()}
      if "label" not in screenshot_columns:
        await connection.execute("ALTER TABLE trade_screenshots ADD COLUMN label TEXT")

    await connection.commit()


def enable_foreign_keys() -> None:
  """Force `PRAGMA foreign_keys = ON` on every pooled connection.

  SQLite disables foreign keys by default and the pragma is per-connection.
  The `databases` SQLite backend opens a fresh connection for each query, so a
  one-off pragma at startup would not stick — we wrap the pool's `acquire` to
  run it on every connection it hands out. Idempotent: re-running is a no-op.
  """
  pool = database._backend._pool
  if getattr(pool, "_foreign_keys_enabled", False):
    return

  original_acquire = pool.acquire

  async def acquire_with_foreign_keys() -> aiosqlite.Connection:
    connection = await original_acquire()
    await connection.execute("PRAGMA foreign_keys = ON")
    return connection

  pool.acquire = acquire_with_foreign_keys
  pool._foreign_keys_enabled = True


async def init_db() -> None:
  """Create the data directory, apply the schema, then connect."""
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
  await apply_schema()
  await apply_migrations()
  enable_foreign_keys()
  await database.connect()


async def close_db() -> None:
  """Disconnect from the database."""
  await database.disconnect()
