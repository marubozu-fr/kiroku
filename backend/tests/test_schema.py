import asyncio
import sqlite3
from pathlib import Path

import pytest

from app import database
from app.database import SCHEMA_PATH, apply_migrations, apply_schema, enable_foreign_keys

EXPECTED_TABLES = {
  "assets",
  "tags",
  "emotions",
  "trades",
  "trade_activities",
  "trade_tags",
  "trade_emotions",
  "trade_screenshots",
  "user_preferences",
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


def test_schema_seeds_single_preferences_row() -> None:
  connection = _load_schema()
  # Re-run the schema: INSERT OR IGNORE must not duplicate the seeded row.
  connection.executescript(SCHEMA_PATH.read_text())
  rows = connection.execute(
    "SELECT id, risk_per_trade_default FROM user_preferences"
  ).fetchall()
  assert rows == [(1, 1.0)]


def test_schema_assets_has_nullable_massive_ticker() -> None:
  # massive_ticker (issue #184) must exist on a fresh assets table, be nullable,
  # and carry no default.
  connection = _load_schema()
  columns = {
    row[1]: row for row in connection.execute("PRAGMA table_info(assets)").fetchall()
  }
  assert "massive_ticker" in columns
  # PRAGMA columns: (cid, name, type, notnull, dflt_value, pk).
  _, _, col_type, notnull, default, _ = columns["massive_ticker"]
  assert col_type == "TEXT"
  assert notnull == 0
  assert default is None


def test_schema_seeds_empty_massive_api_key() -> None:
  # A fresh database seeds the single preferences row with an empty Massive API
  # key (feature disabled until the user provides one).
  connection = _load_schema()
  value = connection.execute(
    "SELECT massive_api_key FROM user_preferences WHERE id = 1"
  ).fetchone()[0]
  assert value == ""


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


def test_migration_adds_account_type_and_backfills_live(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  # A legacy database created before these migrations existed: it still carries
  # the dropped realized_pnl column (issue #54) and lacks account_type (#48).
  # Migrations must drop the former and back-fill the latter.
  db_path = tmp_path / "kiroku.db"
  monkeypatch.setattr(database, "DB_PATH", db_path)

  connection = sqlite3.connect(db_path)
  connection.execute(
    "CREATE TABLE trades (id INTEGER PRIMARY KEY, status TEXT NOT NULL, realized_pnl REAL)"
  )
  connection.execute("INSERT INTO trades (id, status) VALUES (1, 'Open')")
  connection.commit()
  connection.close()

  asyncio.run(apply_migrations())

  connection = sqlite3.connect(db_path)
  columns = {row[1] for row in connection.execute("PRAGMA table_info(trades)").fetchall()}
  backfilled = connection.execute("SELECT account_type FROM trades WHERE id = 1").fetchone()[0]
  connection.close()

  # realized_pnl is dropped; account_type is added and back-fills to 'live'.
  assert "realized_pnl" not in columns
  assert "account_type" in columns
  assert backfilled == "live"


def test_migration_adds_screenshot_label(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  # A legacy trade_screenshots table created before the label column (issue #56)
  # must gain it on migration, leaving existing rows with a NULL label.
  db_path = tmp_path / "kiroku.db"
  monkeypatch.setattr(database, "DB_PATH", db_path)

  connection = sqlite3.connect(db_path)
  # A current trades table (with account_type) so the unrelated trades
  # migrations are no-ops and only the screenshot label step is exercised.
  connection.execute(
    "CREATE TABLE trades (id INTEGER PRIMARY KEY, status TEXT NOT NULL, "
    "account_type TEXT NOT NULL DEFAULT 'live')"
  )
  connection.execute(
    "CREATE TABLE trade_screenshots ("
    "id INTEGER PRIMARY KEY, trade_id INTEGER, filename TEXT, "
    "timeframe_unit TEXT, timeframe_value INTEGER, created_at TEXT)"
  )
  connection.execute(
    "INSERT INTO trade_screenshots (id, trade_id, filename) VALUES (1, 1, 'a.png')"
  )
  connection.commit()
  connection.close()

  asyncio.run(apply_migrations())
  # Idempotent: a second run must not raise on the now-current table.
  asyncio.run(apply_migrations())

  connection = sqlite3.connect(db_path)
  columns = {
    row[1] for row in connection.execute("PRAGMA table_info(trade_screenshots)").fetchall()
  }
  label = connection.execute("SELECT label FROM trade_screenshots WHERE id = 1").fetchone()[0]
  connection.close()
  assert "label" in columns
  assert label is None


def test_migration_account_type_is_idempotent(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  # Running migrations twice on a current database must not raise (the
  # column-presence guard makes the account_type step a no-op).
  db_path = tmp_path / "kiroku.db"
  monkeypatch.setattr(database, "DB_PATH", db_path)

  asyncio.run(apply_schema())
  asyncio.run(apply_migrations())
  asyncio.run(apply_migrations())

  connection = sqlite3.connect(db_path)
  columns = {row[1] for row in connection.execute("PRAGMA table_info(trades)").fetchall()}
  connection.close()
  assert "account_type" in columns


def test_migration_adds_news_preference_columns(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  # A legacy user_preferences table created before the news settings (issue
  # #159) must gain the three news columns, back-filled to their defaults.
  db_path = tmp_path / "kiroku.db"
  monkeypatch.setattr(database, "DB_PATH", db_path)

  connection = sqlite3.connect(db_path)
  # A current trades table so the unrelated trades migrations are no-ops and
  # only the user_preferences step is exercised.
  connection.execute(
    "CREATE TABLE trades (id INTEGER PRIMARY KEY, status TEXT NOT NULL, "
    "account_type TEXT NOT NULL DEFAULT 'live')"
  )
  connection.execute(
    "CREATE TABLE user_preferences ("
    "id INTEGER PRIMARY KEY CHECK (id = 1), "
    "risk_per_trade_default REAL NOT NULL DEFAULT 1.0)"
  )
  connection.execute("INSERT INTO user_preferences (id) VALUES (1)")
  connection.commit()
  connection.close()

  asyncio.run(apply_migrations())
  # Idempotent: a second run must not raise on the now-current table.
  asyncio.run(apply_migrations())

  connection = sqlite3.connect(db_path)
  columns = {
    row[1] for row in connection.execute("PRAGMA table_info(user_preferences)").fetchall()
  }
  row = connection.execute(
    "SELECT news_enabled, news_currencies, news_min_impact FROM user_preferences WHERE id = 1"
  ).fetchone()
  connection.close()

  assert {"news_enabled", "news_currencies", "news_min_impact"} <= columns
  assert row[0] == 1
  assert row[1] == '["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "NZD"]'
  assert row[2] == "MEDIUM"


def test_migration_adds_massive_ticker_to_assets(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  # A legacy assets table created before massive_ticker (issue #184) must gain
  # the column on migration, preserving existing rows with a NULL ticker.
  db_path = tmp_path / "kiroku.db"
  monkeypatch.setattr(database, "DB_PATH", db_path)

  connection = sqlite3.connect(db_path)
  # A current trades table so the unrelated trades migrations are no-ops and
  # only the assets step is exercised.
  connection.execute(
    "CREATE TABLE trades (id INTEGER PRIMARY KEY, status TEXT NOT NULL, "
    "account_type TEXT NOT NULL DEFAULT 'live')"
  )
  connection.execute(
    "CREATE TABLE assets ("
    "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, "
    "category TEXT NOT NULL, currency TEXT, is_active BOOLEAN NOT NULL DEFAULT 1)"
  )
  connection.execute(
    "INSERT INTO assets (id, name, category) VALUES (1, 'EURUSD', 'Forex')"
  )
  connection.commit()
  connection.close()

  asyncio.run(apply_migrations())
  # Idempotent: a second run must not raise on the now-current table.
  asyncio.run(apply_migrations())

  connection = sqlite3.connect(db_path)
  columns = {row[1] for row in connection.execute("PRAGMA table_info(assets)").fetchall()}
  ticker = connection.execute("SELECT massive_ticker FROM assets WHERE id = 1").fetchone()[0]
  name = connection.execute("SELECT name FROM assets WHERE id = 1").fetchone()[0]
  connection.close()

  assert "massive_ticker" in columns
  assert ticker is None
  # Existing asset data is preserved (migration is additive).
  assert name == "EURUSD"


def test_migration_adds_massive_api_key(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  # A legacy user_preferences table created before massive_api_key (issue #184)
  # must gain the column, back-filled to an empty string.
  db_path = tmp_path / "kiroku.db"
  monkeypatch.setattr(database, "DB_PATH", db_path)

  connection = sqlite3.connect(db_path)
  # A current trades table so the unrelated trades migrations are no-ops.
  connection.execute(
    "CREATE TABLE trades (id INTEGER PRIMARY KEY, status TEXT NOT NULL, "
    "account_type TEXT NOT NULL DEFAULT 'live')"
  )
  connection.execute(
    "CREATE TABLE user_preferences ("
    "id INTEGER PRIMARY KEY CHECK (id = 1), "
    "risk_per_trade_default REAL NOT NULL DEFAULT 1.0)"
  )
  connection.execute("INSERT INTO user_preferences (id) VALUES (1)")
  connection.commit()
  connection.close()

  asyncio.run(apply_migrations())
  # Idempotent: a second run must not raise on the now-current table.
  asyncio.run(apply_migrations())

  connection = sqlite3.connect(db_path)
  columns = {
    row[1] for row in connection.execute("PRAGMA table_info(user_preferences)").fetchall()
  }
  value = connection.execute(
    "SELECT massive_api_key FROM user_preferences WHERE id = 1"
  ).fetchone()[0]
  connection.close()

  assert "massive_api_key" in columns
  assert value == ""


def test_migration_adds_chart_timeframe_columns(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  # A legacy user_preferences table created before the chart-timeframe columns
  # (issue #235) must gain all three on migration, with chart_timeframes_default
  # back-filled to '[]' and the entry-timeframe pair defaulting to NULL.
  db_path = tmp_path / "kiroku.db"
  monkeypatch.setattr(database, "DB_PATH", db_path)

  connection = sqlite3.connect(db_path)
  # A current trades table (no timeframe_unit) so the trades migrations are no-ops.
  connection.execute(
    "CREATE TABLE trades (id INTEGER PRIMARY KEY, status TEXT NOT NULL, "
    "account_type TEXT NOT NULL DEFAULT 'live')"
  )
  connection.execute(
    "CREATE TABLE user_preferences ("
    "id INTEGER PRIMARY KEY CHECK (id = 1), "
    "risk_per_trade_default REAL NOT NULL DEFAULT 1.0)"
  )
  connection.execute("INSERT INTO user_preferences (id) VALUES (1)")
  connection.commit()
  connection.close()

  asyncio.run(apply_migrations())
  # Idempotent: a second run must not raise on the now-current table.
  asyncio.run(apply_migrations())

  connection = sqlite3.connect(db_path)
  columns = {
    row[1] for row in connection.execute("PRAGMA table_info(user_preferences)").fetchall()
  }
  row = connection.execute(
    "SELECT chart_timeframes_default, entry_timeframe_unit_default, "
    "entry_timeframe_value_default FROM user_preferences WHERE id = 1"
  ).fetchone()
  connection.close()

  assert {
    "chart_timeframes_default",
    "entry_timeframe_unit_default",
    "entry_timeframe_value_default",
  } <= columns
  # chart_timeframes_default back-fills to the NOT NULL DEFAULT '[]'.
  assert row[0] == "[]"
  # entry-timeframe pair defaults to NULL (nullable columns).
  assert row[1] is None
  assert row[2] is None


def test_migration_normalises_timeframe_unit_casing(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  # Legacy trades and trade_screenshots rows with lowercase 'd' or 'w'
  # timeframe units must be migrated to 'D'/'W' (TradingView casing, issue
  # #235). Lowercase 'm' and 'h' must be left untouched. Idempotent.
  db_path = tmp_path / "kiroku.db"
  monkeypatch.setattr(database, "DB_PATH", db_path)

  connection = sqlite3.connect(db_path)
  connection.execute(
    "CREATE TABLE trades ("
    "id INTEGER PRIMARY KEY, status TEXT NOT NULL, "
    "account_type TEXT NOT NULL DEFAULT 'live', "
    "timeframe_unit TEXT, timeframe_value INTEGER)"
  )
  connection.execute(
    "CREATE TABLE trade_screenshots ("
    "id INTEGER PRIMARY KEY, trade_id INTEGER, filename TEXT, "
    "timeframe_unit TEXT, timeframe_value INTEGER, created_at TEXT)"
  )
  connection.executemany(
    "INSERT INTO trades (id, status, timeframe_unit) VALUES (?, 'closed', ?)",
    [(1, "d"), (2, "w"), (3, "m"), (4, "h"), (5, None)],
  )
  connection.executemany(
    "INSERT INTO trade_screenshots (id, trade_id, filename, timeframe_unit) "
    "VALUES (?, ?, 'a.png', ?)",
    [(1, 1, "d"), (2, 2, "w"), (3, 3, "h")],
  )
  connection.commit()
  connection.close()

  asyncio.run(apply_migrations())
  # Idempotent: re-migrated rows have no 'd'/'w' left so the second run is a
  # no-op and must not raise.
  asyncio.run(apply_migrations())

  connection = sqlite3.connect(db_path)
  trade_units = {
    row[0]: row[1]
    for row in connection.execute("SELECT id, timeframe_unit FROM trades").fetchall()
  }
  screenshot_units = {
    row[0]: row[1]
    for row in connection.execute(
      "SELECT id, timeframe_unit FROM trade_screenshots"
    ).fetchall()
  }
  connection.close()

  # Lowercase 'd' → 'D', 'w' → 'W'; 'm' and 'h' are untouched; NULL stays NULL.
  assert trade_units[1] == "D"
  assert trade_units[2] == "W"
  assert trade_units[3] == "m"
  assert trade_units[4] == "h"
  assert trade_units[5] is None
  assert screenshot_units[1] == "D"
  assert screenshot_units[2] == "W"
  assert screenshot_units[3] == "h"


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
