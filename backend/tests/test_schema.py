import asyncio
import sqlite3
from pathlib import Path

import pytest

from app import database
from app.database import SCHEMA_PATH, apply_schema, enable_foreign_keys

EXPECTED_TABLES = {
  "assets",
  "tags",
  "emotions",
  "trades",
  "trade_activities",
  "trade_tags",
  "trade_emotions",
  "trade_screenshots",
}

# Child tables whose foreign key to the parent must cascade on delete.
CASCADE_FOREIGN_KEYS = {
  "trade_activities": "trades",
  "trade_tags": "trades",
  "trade_emotions": "trades",
  "trade_screenshots": "trades",
}

EXPECTED_INDEXES = {
  "idx_trades_asset_id",
  "idx_trades_trade_date",
  "idx_trades_status",
}


def _load_schema() -> sqlite3.Connection:
  connection = sqlite3.connect(":memory:")
  connection.executescript(SCHEMA_PATH.read_text())
  return connection


def test_schema_creates_all_tables() -> None:
  connection = _load_schema()
  rows = connection.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
  ).fetchall()
  tables = {row[0] for row in rows}
  assert EXPECTED_TABLES <= tables


def test_expected_indexes_exist() -> None:
  connection = _load_schema()
  rows = connection.execute(
    "SELECT name FROM sqlite_master WHERE type = 'index'"
  ).fetchall()
  indexes = {row[0] for row in rows}
  assert EXPECTED_INDEXES <= indexes


@pytest.mark.parametrize("child, parent", CASCADE_FOREIGN_KEYS.items())
def test_foreign_keys_cascade_on_delete(child: str, parent: str) -> None:
  connection = _load_schema()
  foreign_keys = connection.execute(
    f"PRAGMA foreign_key_list({child})"
  ).fetchall()
  # Column 2 is the referenced table, column 6 is the ON DELETE action.
  cascading = [fk for fk in foreign_keys if fk[2] == parent and fk[6] == "CASCADE"]
  assert cascading, f"{child} must cascade-delete from {parent}"


def test_schema_is_idempotent() -> None:
  connection = _load_schema()
  # Re-running the schema must not raise (CREATE ... IF NOT EXISTS).
  connection.executescript(SCHEMA_PATH.read_text())


def test_apply_schema_creates_database_file(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  db_path = tmp_path / "kiroku.db"
  monkeypatch.setattr(database, "DB_PATH", db_path)

  asyncio.run(apply_schema())

  assert db_path.exists()
  connection = sqlite3.connect(db_path)
  rows = connection.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
  ).fetchall()
  tables = {row[0] for row in rows}
  assert EXPECTED_TABLES <= tables


def test_pool_enforces_foreign_keys(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  from databases import Database

  db_path = tmp_path / "kiroku.db"
  db = Database(f"sqlite+aiosqlite:///{db_path}")
  monkeypatch.setattr(database, "DB_PATH", db_path)
  monkeypatch.setattr(database, "database", db)

  async def scenario() -> None:
    await apply_schema()
    enable_foreign_keys()
    await db.connect()
    try:
      # Each query opens a fresh connection: the pragma must be set every time.
      assert await db.fetch_val("PRAGMA foreign_keys") == 1

      await db.execute(
        "INSERT INTO trades (id, status) VALUES (1, 'Open')"
      )
      await db.execute(
        "INSERT INTO trade_activities (trade_id, type, price, quantity, date) "
        "VALUES (1, 'Buy', 1.0, 1.0, '2026-01-01')"
      )

      # ON DELETE CASCADE removes the child activity.
      await db.execute("DELETE FROM trades WHERE id = 1")
      assert await db.fetch_val("SELECT COUNT(*) FROM trade_activities") == 0

      # A dangling foreign key is rejected.
      with pytest.raises(Exception):
        await db.execute(
          "INSERT INTO trade_activities (trade_id, type, price, quantity, date) "
          "VALUES (999, 'Buy', 1.0, 1.0, '2026-01-01')"
        )
    finally:
      await db.disconnect()

  asyncio.run(scenario())
