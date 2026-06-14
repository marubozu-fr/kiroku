import os
import sqlite3
import tempfile
from pathlib import Path

# Point the app at a throwaway database BEFORE app.database is imported so the
# real backend/data/kiroku.db is never touched by the test suite.
_TEST_DIR = Path(tempfile.mkdtemp(prefix="kiroku-test-"))
_TEST_DB = _TEST_DIR / "test.db"
os.environ["KIROKU_DB_PATH"] = str(_TEST_DB)

import pytest  # noqa: E402

from app.database import SCHEMA_PATH  # noqa: E402


@pytest.fixture(autouse=True)
def clean_database() -> None:
  """Reset the reference tables before each test for deterministic results."""
  connection = sqlite3.connect(_TEST_DB)
  connection.executescript(SCHEMA_PATH.read_text())
  # Delete child rows before parents (this connection has foreign_keys OFF).
  connection.execute("DELETE FROM trade_screenshots")
  connection.execute("DELETE FROM trade_emotions")
  connection.execute("DELETE FROM trade_tags")
  connection.execute("DELETE FROM trade_activities")
  connection.execute("DELETE FROM trades")
  connection.execute("DELETE FROM assets")
  connection.execute("DELETE FROM tags")
  connection.execute("DELETE FROM emotions")
  connection.execute("DELETE FROM news_events")
  # Reset the singleton preferences row to its seeded default so each test
  # starts from a known state (the re-run schema only re-seeds a missing row).
  connection.execute("DELETE FROM user_preferences")
  connection.execute(
    "INSERT INTO user_preferences (id, risk_per_trade_default) VALUES (1, 1.0)"
  )
  connection.commit()
  connection.close()
  yield
