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
    await connection.executescript(schema)
    await connection.commit()


async def init_db() -> None:
  """Create the data directory, apply the schema, then connect."""
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  await apply_schema()
  await database.connect()


async def close_db() -> None:
  """Disconnect from the database."""
  await database.disconnect()
