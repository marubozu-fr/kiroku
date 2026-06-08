from pathlib import Path

from databases import Database

# SQLite file lives in backend/data/kiroku.db, created on first run (gitignored).
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "kiroku.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

database = Database(DATABASE_URL)


async def init_db() -> None:
  """Connect to the database, creating the data directory if needed."""
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  await database.connect()


async def close_db() -> None:
  """Disconnect from the database."""
  await database.disconnect()
