from pathlib import Path

import aiosqlite
from databases import Database

# SQLite file lives in backend/data/kiroku.db, created on first run (gitignored).
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "kiroku.db"
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
  enable_foreign_keys()
  await database.connect()


async def close_db() -> None:
  """Disconnect from the database."""
  await database.disconnect()
