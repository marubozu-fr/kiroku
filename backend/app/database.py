import os
from pathlib import Path

import aiosqlite
from databases import Database

# SQLite file lives in backend/data/kiroku.db, created on first run (gitignored).
# KIROKU_DB_PATH overrides the location (used by the test suite for isolation).
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = Path(os.environ.get("KIROKU_DB_PATH", DATA_DIR / "kiroku.db"))
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

    # realized_pnl (issue #26): monetary P&L on the exited portion of a trade.
    # Back-fill = stored reward (per-unit, direction-adjusted) × total exit
    # quantity. Exits are Sell for a Long, Buy for a Short. reward is NULL for
    # open trades and missed opportunities are excluded, so both stay NULL.
    if "realized_pnl" not in columns:
      await connection.execute("ALTER TABLE trades ADD COLUMN realized_pnl REAL")
      await connection.execute(
        """
        UPDATE trades
        SET realized_pnl = ROUND(
          reward * (
            SELECT COALESCE(SUM(ta.quantity), 0)
            FROM trade_activities ta
            WHERE ta.trade_id = trades.id
              AND ta.type = CASE WHEN trades.direction = 'Long' THEN 'Sell' ELSE 'Buy' END
          ),
          5
        )
        WHERE reward IS NOT NULL AND missed_opportunity = 0
        """
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
  await apply_schema()
  await apply_migrations()
  enable_foreign_keys()
  await database.connect()


async def close_db() -> None:
  """Disconnect from the database."""
  await database.disconnect()
