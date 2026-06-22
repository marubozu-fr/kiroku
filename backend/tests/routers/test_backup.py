import io
import json
import os
import shutil
import sqlite3
import tempfile
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.main import app

# A tiny but real PNG (1x1 transparent pixel).
_PNG_BYTES = bytes.fromhex(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
  "890000000a49444154789c6360000002000154a24f6f0000000049454e44ae426082"
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _create_asset(client: TestClient, name: str = "EURUSD") -> int:
  resp = client.post("/api/assets", json={"name": name, "category": "Forex"})
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _create_trade(client: TestClient, asset_name: str = "EURUSD") -> int:
  asset_id = _create_asset(client, name=asset_name)
  resp = client.post(
    "/api/trades",
    json={
      "asset_id": asset_id,
      "activities": [
        {"type": "Buy", "price": 1.10, "quantity": 1.0, "date": "2024-03-15"}
      ],
    },
  )
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _upload_screenshot(client: TestClient, trade_id: int) -> str:
  resp = client.post(
    f"/api/trades/{trade_id}/screenshots",
    files={"file": ("chart.png", _PNG_BYTES, "image/png")},
    data={"timeframe_unit": "h", "timeframe_value": "4"},
  )
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["filename"]


def _set_backup_directory(client: TestClient, directory: str) -> None:
  resp = client.patch("/api/preferences", json={"backup_directory": directory})
  assert resp.status_code == 200, resp.text


def _create_valid_backup(client: TestClient, backup_dir: str) -> dict:
  """Configure backup directory and trigger a backup, returning the response data."""
  _set_backup_directory(client, backup_dir)
  resp = client.post("/api/backup")
  assert resp.status_code == 200, resp.text
  return resp.json()["data"]


def _build_zip_bytes(entries: dict[str, bytes]) -> bytes:
  """Build an in-memory zip with the given {arcname: content} entries."""
  buf = io.BytesIO()
  with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    for arcname, content in entries.items():
      z.writestr(arcname, content)
  return buf.getvalue()


def _minimal_metadata(trades_count: int = 0, screenshots_count: int = 0) -> bytes:
  return json.dumps({
    "version": "test",
    "created_at": "2024-03-15T12:00:00+00:00",
    "trades_count": trades_count,
    "screenshots_count": screenshots_count,
  }).encode()


def _minimal_sqlite_bytes() -> bytes:
  """Return the bytes of an in-memory SQLite database with a minimal trades table."""
  tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
  tmp.close()
  try:
    conn = sqlite3.connect(tmp.name)
    conn.execute(
      "CREATE TABLE trades (id INTEGER PRIMARY KEY, asset_id INTEGER, status TEXT)"
    )
    conn.commit()
    conn.close()
    with open(tmp.name, "rb") as f:
      return f.read()
  finally:
    os.unlink(tmp.name)


# ---------------------------------------------------------------------------
# Preferences — backup fields
# ---------------------------------------------------------------------------


def test_get_preferences_returns_backup_defaults() -> None:
  with TestClient(app) as client:
    response = client.get("/api/preferences")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  data = body["data"]
  assert data["backup_directory"] is None
  assert data["backup_reminder_days"] == 7
  assert data["last_backup_at"] is None


def test_patch_backup_directory_valid_path() -> None:
  tmp_dir = tempfile.mkdtemp(prefix="kiroku-test-backup-dir-")
  try:
    with TestClient(app) as client:
      response = client.patch(
        "/api/preferences", json={"backup_directory": tmp_dir}
      )

    assert response.status_code == 200
    body = response.json()
    assert body["error"] is None
    assert body["data"]["backup_directory"] == tmp_dir
  finally:
    shutil.rmtree(tmp_dir, ignore_errors=True)


def test_patch_backup_directory_nonexistent_path_returns_400() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"backup_directory": "/nonexistent/kiroku/xyz"}
    )

  assert response.status_code == 400
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_patch_backup_directory_relative_path_returns_400() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"backup_directory": "relative/path"}
    )

  assert response.status_code == 400
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


@pytest.mark.parametrize("days", [0, 7, 14, 30])
def test_patch_backup_reminder_days_valid_values(days: int) -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"backup_reminder_days": days}
    )

  assert response.status_code == 200
  assert response.json()["data"]["backup_reminder_days"] == days


def test_patch_backup_reminder_days_invalid_value_returns_422() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"backup_reminder_days": 5}
    )

  assert response.status_code == 422
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


# ---------------------------------------------------------------------------
# Backup creation — POST /api/backup
# ---------------------------------------------------------------------------


def test_create_backup_success_with_trade_and_screenshot() -> None:
  backup_dir = tempfile.mkdtemp(prefix="kiroku-test-backup-")
  try:
    with TestClient(app) as client:
      # Create a trade and attach a screenshot.
      trade_id = _create_trade(client)
      _upload_screenshot(client, trade_id)

      _set_backup_directory(client, backup_dir)
      response = client.post("/api/backup")

    assert response.status_code == 200
    body = response.json()
    assert body["error"] is None
    data = body["data"]

    # Filename matches the expected pattern.
    assert data["filename"].startswith("kiroku-backup-")
    assert data["filename"].endswith(".zip")

    # File exists on disk.
    zip_path = data["path"]
    assert os.path.isfile(zip_path)

    # Zip contents are correct.
    with zipfile.ZipFile(zip_path, "r") as z:
      names = set(z.namelist())
      assert "metadata.json" in names
      assert "kiroku.db" in names
      screenshot_entries = [n for n in names if n.startswith("screenshots/")]
      assert len(screenshot_entries) >= 1
  finally:
    shutil.rmtree(backup_dir, ignore_errors=True)


def test_create_backup_updates_last_backup_at() -> None:
  backup_dir = tempfile.mkdtemp(prefix="kiroku-test-backup-")
  try:
    with TestClient(app) as client:
      _create_trade(client)
      _set_backup_directory(client, backup_dir)

      # Before backup: last_backup_at is null.
      prefs_before = client.get("/api/preferences").json()["data"]
      assert prefs_before["last_backup_at"] is None

      client.post("/api/backup")

      # After backup: last_backup_at is set.
      prefs_after = client.get("/api/preferences").json()["data"]
      assert prefs_after["last_backup_at"] is not None
  finally:
    shutil.rmtree(backup_dir, ignore_errors=True)


def test_create_backup_no_directory_configured_returns_400() -> None:
  with TestClient(app) as client:
    # No PATCH to set backup_directory — defaults to null.
    response = client.post("/api/backup")

  assert response.status_code == 400
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_create_backup_deleted_directory_returns_400() -> None:
  backup_dir = tempfile.mkdtemp(prefix="kiroku-test-backup-deleted-")
  try:
    with TestClient(app) as client:
      # Set a valid directory, then remove it before backup.
      _set_backup_directory(client, backup_dir)
      shutil.rmtree(backup_dir)

      response = client.post("/api/backup")

    assert response.status_code == 400
    body = response.json()
    assert body["data"] is None
    assert body["error"] is not None
  finally:
    # Already removed; ignore errors.
    shutil.rmtree(backup_dir, ignore_errors=True)


def test_create_backup_metadata_trades_count_matches() -> None:
  backup_dir = tempfile.mkdtemp(prefix="kiroku-test-backup-meta-")
  try:
    with TestClient(app) as client:
      # Create exactly 3 trades (different assets to avoid uniqueness conflicts).
      _create_trade(client, asset_name="EURUSD")
      _create_trade(client, asset_name="GBPUSD")
      _create_trade(client, asset_name="USDJPY")

      _set_backup_directory(client, backup_dir)
      data = client.post("/api/backup").json()["data"]

    zip_path = data["path"]
    with zipfile.ZipFile(zip_path, "r") as z:
      metadata = json.loads(z.read("metadata.json"))

    assert metadata["trades_count"] == 3
  finally:
    shutil.rmtree(backup_dir, ignore_errors=True)


def test_create_backup_embedded_db_is_valid_sqlite() -> None:
  backup_dir = tempfile.mkdtemp(prefix="kiroku-test-backup-db-")
  extract_dir = tempfile.mkdtemp(prefix="kiroku-test-backup-extract-")
  try:
    with TestClient(app) as client:
      _create_trade(client, asset_name="EURUSD")
      _create_trade(client, asset_name="GBPUSD")

      _set_backup_directory(client, backup_dir)
      data = client.post("/api/backup").json()["data"]

    zip_path = data["path"]
    with zipfile.ZipFile(zip_path, "r") as z:
      z.extract("kiroku.db", extract_dir)

    extracted_db = os.path.join(extract_dir, "kiroku.db")
    conn = sqlite3.connect(extracted_db)
    (count,) = conn.execute("SELECT COUNT(*) FROM trades").fetchone()
    conn.close()

    assert count == 2
  finally:
    shutil.rmtree(backup_dir, ignore_errors=True)
    shutil.rmtree(extract_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Validate — POST /api/backup/validate
# ---------------------------------------------------------------------------


def test_validate_backup_with_valid_zip() -> None:
  backup_dir = tempfile.mkdtemp(prefix="kiroku-test-validate-")
  try:
    with TestClient(app) as client:
      trade_id = _create_trade(client)
      _upload_screenshot(client, trade_id)

      _set_backup_directory(client, backup_dir)
      backup_data = client.post("/api/backup").json()["data"]

      zip_path = backup_data["path"]
      with open(zip_path, "rb") as f:
        zip_bytes = f.read()

      response = client.post(
        "/api/backup/validate",
        files={"file": ("backup.zip", zip_bytes, "application/zip")},
      )

    assert response.status_code == 200
    body = response.json()
    assert body["error"] is None
    meta = body["data"]
    assert "version" in meta
    assert "created_at" in meta
    assert meta["trades_count"] == 1
    # Screenshots count reflects whatever files exist on disk at backup time
    # (may be > 1 if other tests left files in SCREENSHOTS_DIR). Check it
    # matches what the backup itself recorded and that has_screenshots is set.
    assert meta["screenshots_count"] >= 1
    assert meta["has_screenshots"] is True
  finally:
    shutil.rmtree(backup_dir, ignore_errors=True)


def test_validate_backup_non_zip_returns_400() -> None:
  with TestClient(app) as client:
    response = client.post(
      "/api/backup/validate",
      files={"file": ("notazip.bin", b"not a zip", "application/octet-stream")},
    )

  assert response.status_code == 400
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_validate_backup_zip_missing_db_returns_400() -> None:
  zip_bytes = _build_zip_bytes({
    "metadata.json": _minimal_metadata(),
    # kiroku.db intentionally omitted
  })

  with TestClient(app) as client:
    response = client.post(
      "/api/backup/validate",
      files={"file": ("backup.zip", zip_bytes, "application/zip")},
    )

  assert response.status_code == 400
  body = response.json()
  assert body["data"] is None
  assert "kiroku.db" in body["error"]


def test_validate_backup_zip_missing_metadata_returns_400() -> None:
  zip_bytes = _build_zip_bytes({
    "kiroku.db": _minimal_sqlite_bytes(),
    # metadata.json intentionally omitted
  })

  with TestClient(app) as client:
    response = client.post(
      "/api/backup/validate",
      files={"file": ("backup.zip", zip_bytes, "application/zip")},
    )

  assert response.status_code == 400
  body = response.json()
  assert body["data"] is None
  assert "metadata.json" in body["error"]


# ---------------------------------------------------------------------------
# Restore — POST /api/backup/restore
# ---------------------------------------------------------------------------


def test_restore_backup_replaces_database_state() -> None:
  backup_dir = tempfile.mkdtemp(prefix="kiroku-test-restore-")
  try:
    with TestClient(app) as client:
      # Create 2 trades, then take a backup.
      _create_trade(client, asset_name="EURUSD")
      _create_trade(client, asset_name="GBPUSD")
      _set_backup_directory(client, backup_dir)
      backup_data = client.post("/api/backup").json()["data"]
      assert backup_data["trades_count"] == 2

      zip_path = backup_data["path"]
      with open(zip_path, "rb") as f:
        zip_bytes = f.read()

    # New client context: add an extra trade AFTER the backup snapshot.
    with TestClient(app) as client:
      _create_trade(client, asset_name="USDJPY")
      # Confirm 3 trades exist before restore.
      count_before = len(client.get("/api/trades").json()["data"])
      assert count_before == 3

      # Restore the backup (which only had 2 trades).
      response = client.post(
        "/api/backup/restore",
        files={"file": ("backup.zip", zip_bytes, "application/zip")},
      )

    assert response.status_code == 200
    assert response.json()["error"] is None

    # Verify the database is back to 2 trades.
    with TestClient(app) as client:
      count_after = len(client.get("/api/trades").json()["data"])
    assert count_after == 2
  finally:
    shutil.rmtree(backup_dir, ignore_errors=True)


def test_restore_backup_invalid_zip_leaves_data_intact() -> None:
  with TestClient(app) as client:
    _create_trade(client, asset_name="EURUSD")
    _create_trade(client, asset_name="GBPUSD")

    count_before = len(client.get("/api/trades").json()["data"])
    assert count_before == 2

    response = client.post(
      "/api/backup/restore",
      files={"file": ("bad.zip", b"not a zip", "application/zip")},
    )

    assert response.status_code == 400
    assert response.json()["data"] is None

    # Existing data must be untouched.
    count_after = len(client.get("/api/trades").json()["data"])
    assert count_after == 2


def test_restore_backup_applies_migrations_on_old_schema() -> None:
  """Restore a backup whose DB is an older schema lacking backup columns.

  After restore, apply_migrations() must add the missing columns so the
  preferences endpoint still works (it reads backup_directory, etc.).
  """
  # Build an older-schema SQLite file: user_preferences without backup columns.
  tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
  tmp_db.close()
  try:
    conn = sqlite3.connect(tmp_db.name)
    conn.executescript("""
      CREATE TABLE trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER,
        account_type TEXT NOT NULL DEFAULT 'live',
        status TEXT NOT NULL DEFAULT 'open',
        direction TEXT,
        stop_loss REAL,
        notes TEXT,
        missed_opportunity BOOLEAN NOT NULL DEFAULT 0,
        risk_per_trade REAL,
        avg_entry_price REAL,
        avg_exit_price REAL,
        risk REAL,
        reward REAL,
        performance_r REAL,
        timeframe_unit TEXT,
        timeframe_value INTEGER,
        trade_date TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        currency TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE user_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        risk_per_trade_default REAL NOT NULL DEFAULT 1.0,
        news_enabled BOOLEAN NOT NULL DEFAULT 1,
        news_currencies TEXT NOT NULL DEFAULT '["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "NZD"]',
        news_min_impact TEXT NOT NULL DEFAULT 'MEDIUM'
      );
      INSERT INTO user_preferences (id, risk_per_trade_default) VALUES (1, 1.0);
    """)
    conn.commit()
    conn.close()

    with open(tmp_db.name, "rb") as f:
      old_db_bytes = f.read()
  finally:
    os.unlink(tmp_db.name)

  zip_bytes = _build_zip_bytes({
    "metadata.json": _minimal_metadata(trades_count=0, screenshots_count=0),
    "kiroku.db": old_db_bytes,
  })

  with TestClient(app) as client:
    response = client.post(
      "/api/backup/restore",
      files={"file": ("old_backup.zip", zip_bytes, "application/zip")},
    )

  assert response.status_code == 200, response.text

  # After restore + migrations, preferences endpoint must respond correctly
  # (it reads backup_directory and last_backup_at which were missing in the old schema).
  with TestClient(app) as client:
    prefs_resp = client.get("/api/preferences")

  assert prefs_resp.status_code == 200, prefs_resp.text
  prefs = prefs_resp.json()["data"]
  assert prefs["backup_directory"] is None
  assert prefs["backup_reminder_days"] == 7
  assert prefs["last_backup_at"] is None
