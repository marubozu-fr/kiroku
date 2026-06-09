from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import UploadFile

from app.database import SCREENSHOTS_DIR
from app.errors import NotFoundError, ValidationError
from app.repositories import trade_repository

# Accepted image uploads. The stored file extension is derived from the
# content type (never from the client-supplied filename) so a mislabelled or
# malicious name can never influence what lands on disk.
CONTENT_TYPE_EXTENSIONS: dict[str, str] = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
}
EXTENSION_CONTENT_TYPES: dict[str, str] = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


class ScreenshotNotFoundError(NotFoundError):
  """Raised when a screenshot id or filename does not exist."""


class ScreenshotTradeNotFoundError(NotFoundError):
  """Raised when the trade a screenshot belongs to does not exist."""


def _now() -> str:
  """Current UTC time as an ISO 8601 string."""
  return datetime.now(timezone.utc).isoformat()


def _safe_filename(filename: str) -> str:
  """Reject any filename that could escape the screenshots directory.

  A stored filename is always a flat name (no separators), so anything that
  resolves to a different basename — `..`, an embedded slash or backslash, a
  null byte — is a traversal attempt and is refused outright.
  """
  if not filename or filename in {".", ".."}:
    raise ValidationError("Invalid filename")
  if "/" in filename or "\\" in filename or "\x00" in filename:
    raise ValidationError("Invalid filename")
  if Path(filename).name != filename:
    raise ValidationError("Invalid filename")
  return filename


async def upload_screenshot(
  trade_id: int,
  file: UploadFile,
  timeframe_unit: Optional[str],
  timeframe_value: Optional[int],
) -> dict[str, Any]:
  """Validate and persist an uploaded screenshot for a trade.

  The file is stored under data/screenshots/{trade_id}/ with a generated,
  collision-free name. Returns the created screenshot record.
  """
  if await trade_repository.get_trade_by_id(trade_id) is None:
    raise ScreenshotTradeNotFoundError(f"Trade {trade_id} not found")

  extension = CONTENT_TYPE_EXTENSIONS.get(file.content_type or "")
  if extension is None:
    raise ValidationError("Unsupported file type: only JPG, PNG and WebP images are allowed")

  content = await file.read()
  if len(content) == 0:
    raise ValidationError("Uploaded file is empty")
  if len(content) > MAX_FILE_SIZE:
    raise ValidationError("File too large: maximum size is 5MB")

  # A random name guarantees uniqueness and is safe by construction — the
  # client-supplied filename never reaches the filesystem.
  filename = f"{uuid4().hex}{extension}"
  trade_dir = SCREENSHOTS_DIR / str(trade_id)
  trade_dir.mkdir(parents=True, exist_ok=True)
  (trade_dir / filename).write_bytes(content)

  now = _now()
  screenshot_id = await trade_repository.insert_screenshot(
    trade_id, filename, timeframe_unit, timeframe_value, now
  )
  created = await trade_repository.get_screenshot_by_id(screenshot_id)
  assert created is not None
  return created


async def list_screenshots(trade_id: int) -> list[dict[str, Any]]:
  """Return all screenshot records for a trade."""
  if await trade_repository.get_trade_by_id(trade_id) is None:
    raise ScreenshotTradeNotFoundError(f"Trade {trade_id} not found")
  return await trade_repository.get_screenshots(trade_id)


async def delete_screenshot(screenshot_id: int) -> dict[str, Any]:
  """Delete a screenshot record and its file from disk; return the record."""
  record = await trade_repository.get_screenshot_by_id(screenshot_id)
  if record is None:
    raise ScreenshotNotFoundError(f"Screenshot {screenshot_id} not found")

  path = SCREENSHOTS_DIR / str(record["trade_id"]) / record["filename"]
  path.unlink(missing_ok=True)
  await trade_repository.delete_screenshot(screenshot_id)
  return record


async def resolve_screenshot_file(filename: str) -> tuple[Path, str]:
  """Resolve a stored filename to its on-disk path and media type.

  Raises ScreenshotNotFoundError if no record or file matches.
  """
  safe_name = _safe_filename(filename)
  record = await trade_repository.get_screenshot_by_filename(safe_name)
  if record is None:
    raise ScreenshotNotFoundError(f"Screenshot {safe_name} not found")

  path = SCREENSHOTS_DIR / str(record["trade_id"]) / safe_name
  if not path.is_file():
    raise ScreenshotNotFoundError(f"Screenshot {safe_name} not found")

  media_type = EXTENSION_CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
  return path, media_type
