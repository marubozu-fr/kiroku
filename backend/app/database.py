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

    # massive_ticker (issue #184): the Massive API symbol used to fetch chart
    # candles for an asset. Nullable (NULL = no chart data), so existing rows
    # need no back-fill. Guarded by a table- and column-presence check so it is
    # a no-op once the database is current and on databases that predate assets.
    cursor = await connection.execute(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'assets'"
    )
    if await cursor.fetchone() is not None:
      cursor = await connection.execute("PRAGMA table_info(assets)")
      asset_columns = {row[1] for row in await cursor.fetchall()}
      if "massive_ticker" not in asset_columns:
        await connection.execute("ALTER TABLE assets ADD COLUMN massive_ticker TEXT")

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

    # news preferences (issue #159): news filtering settings added to the
    # single user_preferences row. Each column has a NOT NULL DEFAULT, so the
    # ALTER back-fills existing rows with the same defaults. schema.sql seeds for
    # fresh databases. Guarded by a table- and column-presence check so it is a
    # no-op once the database is current and on databases that predate the table.
    cursor = await connection.execute(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user_preferences'"
    )
    if await cursor.fetchone() is not None:
      cursor = await connection.execute("PRAGMA table_info(user_preferences)")
      preference_columns = {row[1] for row in await cursor.fetchall()}
      if "news_enabled" not in preference_columns:
        await connection.execute(
          "ALTER TABLE user_preferences ADD COLUMN news_enabled BOOLEAN NOT NULL DEFAULT 1"
        )
      if "news_currencies" not in preference_columns:
        await connection.execute(
          "ALTER TABLE user_preferences ADD COLUMN news_currencies TEXT NOT NULL "
          "DEFAULT '[\"USD\", \"EUR\", \"GBP\", \"JPY\", \"CAD\", \"AUD\", \"CHF\", \"NZD\"]'"
        )
      if "news_min_impact" not in preference_columns:
        await connection.execute(
          "ALTER TABLE user_preferences ADD COLUMN news_min_impact TEXT NOT NULL "
          "DEFAULT 'MEDIUM'"
        )

      # backup preferences (issue #173): directory path, reminder cadence, and
      # last-backup timestamp. backup_reminder_days has a NOT NULL DEFAULT so
      # existing rows are back-filled to 7; the other two default to NULL.
      if "backup_directory" not in preference_columns:
        await connection.execute(
          "ALTER TABLE user_preferences ADD COLUMN backup_directory TEXT"
        )
      if "backup_reminder_days" not in preference_columns:
        await connection.execute(
          "ALTER TABLE user_preferences ADD COLUMN backup_reminder_days INTEGER NOT NULL DEFAULT 7"
        )
      if "last_backup_at" not in preference_columns:
        await connection.execute(
          "ALTER TABLE user_preferences ADD COLUMN last_backup_at TEXT"
        )

      # massive_api_key (issue #184): API key for the Massive market-data
      # service that backs trade charts. NOT NULL DEFAULT '' back-fills existing
      # rows with an empty key (feature disabled until the user sets one),
      # matching how risk_per_trade_default and the news settings are seeded.
      if "massive_api_key" not in preference_columns:
        await connection.execute(
          "ALTER TABLE user_preferences ADD COLUMN massive_api_key TEXT NOT NULL DEFAULT ''"
        )

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
