import json
import os
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite
from fastapi import UploadFile

from app.database import DB_PATH, SCREENSHOTS_DIR, close_db, init_db
from app.errors import BackupError, ValidationError
from app.repositories import preferences_repository

# VERSION file is at the repository root: backup_service.py -> app/ -> backend/ -> root.
_VERSION_PATH = Path(__file__).resolve().parent.parent.parent / "VERSION"


def _read_version() -> str:
  """Return the application version string, or 'unknown' if not available."""
  try:
    return _VERSION_PATH.read_text().strip()
  except OSError:
    return "unknown"


def _now_iso() -> str:
  """Current UTC time as an ISO 8601 string."""
  return datetime.now(timezone.utc).isoformat()


def _read_and_validate_zip(zip_path: Path) -> dict:
  """Parse and validate a backup zip, returning its metadata dict.

  Raises ValidationError for any structural problem so callers get HTTP 400
  before any destructive operation is attempted.
  """
  if not zipfile.is_zipfile(zip_path):
    raise ValidationError("Uploaded file is not a valid zip archive")

  with zipfile.ZipFile(zip_path, "r") as z:
    names = set(z.namelist())

    if "metadata.json" not in names:
      raise ValidationError("Backup is missing metadata.json")
    if "kiroku.db" not in names:
      raise ValidationError("Backup is missing kiroku.db")

    try:
      metadata = json.loads(z.read("metadata.json"))
    except json.JSONDecodeError:
      raise ValidationError("Backup metadata is malformed")

    required_keys = {"version", "created_at", "trades_count", "screenshots_count"}
    if not required_keys <= metadata.keys():
      raise ValidationError("Backup metadata is incomplete")

    has_screenshots = any(name.startswith("screenshots/") for name in names)

  return {**metadata, "has_screenshots": has_screenshots}


async def create_backup() -> dict:
  """Create a zip backup of the database and screenshots in the configured directory.

  Returns a dict with filename, path, created_at, trades_count and screenshots_count.
  Raises ValidationError (HTTP 400) if no directory is configured or the directory
  is invalid; raises BackupError (HTTP 500) on unexpected OS-level failures.
  """
  prefs = await preferences_repository.get()
  directory: str | None = prefs.get("backup_directory")
  if not directory:
    raise ValidationError("No backup directory configured")

  if not Path(directory).is_dir():
    raise ValidationError("Backup directory does not exist")
  if not os.access(directory, os.W_OK):
    raise ValidationError("Backup directory is not writable")

  tmp_dir = Path(tempfile.mkdtemp(prefix="kiroku-backup-"))
  try:
    # Use VACUUM INTO for a consistent, defragmented copy of the live database.
    dest_db = tmp_dir / "kiroku.db"
    async with aiosqlite.connect(DB_PATH) as conn:
      await conn.execute(f"VACUUM INTO '{dest_db}'")

    # Count trades from the snapshot (synchronous sqlite3 is fine for a one-off read).
    with sqlite3.connect(dest_db) as snap:
      (trades_count,) = snap.execute("SELECT COUNT(*) FROM trades").fetchone()

    # Count screenshot files by walking the directory tree.
    screenshots_count = 0
    if SCREENSHOTS_DIR.exists():
      for _root, _dirs, files in os.walk(SCREENSHOTS_DIR):
        screenshots_count += len(files)

    version = _read_version()

    # Compute timestamp once so created_at and the zip filename are consistent.
    now = datetime.now(timezone.utc)
    created_at = now.isoformat()
    stamp = now.strftime("%Y-%m-%dT%H-%M-%S")

    metadata = {
      "version": version,
      "created_at": created_at,
      "trades_count": trades_count,
      "screenshots_count": screenshots_count,
    }
    metadata_path = tmp_dir / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2))

    filename = f"kiroku-backup-{stamp}.zip"
    zip_tmp_path = tmp_dir / filename

    with zipfile.ZipFile(zip_tmp_path, "w", zipfile.ZIP_DEFLATED) as z:
      z.write(metadata_path, arcname="metadata.json")
      z.write(dest_db, arcname="kiroku.db")

      if SCREENSHOTS_DIR.exists():
        for root, _dirs, files in os.walk(SCREENSHOTS_DIR):
          for file in files:
            file_path = Path(root) / file
            # Preserve the {trade_id}/{filename} sub-structure under screenshots/.
            relative = file_path.relative_to(SCREENSHOTS_DIR)
            z.write(file_path, arcname=f"screenshots/{relative.as_posix()}")

    final_path = Path(directory) / filename
    shutil.move(str(zip_tmp_path), str(final_path))

    await preferences_repository.set_last_backup_at(created_at)

    return {
      "filename": filename,
      "path": str(final_path),
      "created_at": created_at,
      "trades_count": trades_count,
      "screenshots_count": screenshots_count,
    }
  finally:
    shutil.rmtree(tmp_dir, ignore_errors=True)


async def validate_backup(file: UploadFile) -> dict:
  """Validate an uploaded backup zip without applying it.

  Returns the metadata dict on success; raises ValidationError on any
  structural problem so the caller receives HTTP 400.
  """
  tmp_dir = Path(tempfile.mkdtemp(prefix="kiroku-validate-"))
  try:
    upload_path = tmp_dir / "upload.zip"
    upload_path.write_bytes(await file.read())
    return _read_and_validate_zip(upload_path)
  finally:
    shutil.rmtree(tmp_dir, ignore_errors=True)


async def restore_backup(file: UploadFile) -> dict:
  """Restore the database and screenshots from an uploaded backup zip.

  Validates the zip first (HTTP 400 on bad input), then atomically replaces
  the live database and screenshots directory. A safety copy is kept for the
  duration of the operation; on any failure the original state is restored and
  BackupError (HTTP 500) is raised.

  Returns the metadata dict from the backup on success.
  """
  tmp_dir = Path(tempfile.mkdtemp(prefix="kiroku-restore-"))
  safety_dir = Path(tempfile.mkdtemp(prefix="kiroku-restore-safety-"))
  try:
    upload_path = tmp_dir / "upload.zip"
    upload_path.write_bytes(await file.read())

    # Validate before touching anything — raises ValidationError (400) early.
    metadata = _read_and_validate_zip(upload_path)

    # --- Safety snapshot ---
    if DB_PATH.exists():
      shutil.copy2(DB_PATH, safety_dir / "kiroku.db")
    if SCREENSHOTS_DIR.exists():
      shutil.copytree(SCREENSHOTS_DIR, safety_dir / "screenshots")

    # Disconnect so we can freely replace the database file.
    await close_db()

    try:
      # a. Replace the database file.
      with zipfile.ZipFile(upload_path, "r") as z:
        DB_PATH.write_bytes(z.read("kiroku.db"))

      # b. Replace the screenshots directory.
      if SCREENSHOTS_DIR.exists():
        for child in list(SCREENSHOTS_DIR.iterdir()):
          if child.is_dir():
            shutil.rmtree(child)
          else:
            child.unlink()
      else:
        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

      with zipfile.ZipFile(upload_path, "r") as z:
        for name in z.namelist():
          if name.startswith("screenshots/") and not name.endswith("/"):
            target = SCREENSHOTS_DIR / Path(name).relative_to("screenshots")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(z.read(name))

      # c. Reconnect and apply any pending migrations on the restored database.
      await init_db()

    except Exception as exc:
      # Rollback: restore the safety snapshot, then reconnect.
      try:
        safety_db = safety_dir / "kiroku.db"
        if safety_db.exists():
          shutil.copy2(safety_db, DB_PATH)

        # Clear whatever partial state was written to the screenshots dir.
        if SCREENSHOTS_DIR.exists():
          for child in list(SCREENSHOTS_DIR.iterdir()):
            if child.is_dir():
              shutil.rmtree(child)
            else:
              child.unlink()
        else:
          SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

        safety_screenshots = safety_dir / "screenshots"
        if safety_screenshots.exists():
          for child in safety_screenshots.iterdir():
            dest = SCREENSHOTS_DIR / child.name
            if child.is_dir():
              shutil.copytree(child, dest)
            else:
              shutil.copy2(child, dest)
      except Exception:
        pass  # Best-effort rollback; the BackupError below still surfaces.

      try:
        await init_db()
      except Exception:
        pass  # Ensure the error below is always raised.

      raise BackupError(f"Restore failed and was rolled back: {exc}")

  finally:
    shutil.rmtree(tmp_dir, ignore_errors=True)
    shutil.rmtree(safety_dir, ignore_errors=True)

  return metadata
