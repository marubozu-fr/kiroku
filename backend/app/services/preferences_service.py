import os
from pathlib import Path
from typing import Any

from app.errors import ValidationError
from app.models.preferences import PreferencesUpdate
from app.repositories import preferences_repository


async def get_preferences() -> dict[str, Any]:
  return await preferences_repository.get()


async def update_preferences(payload: PreferencesUpdate) -> dict[str, Any]:
  # Partial update: only the fields the client actually sent are written.
  # None values are dropped too — the columns are NOT NULL.
  fields = payload.model_dump(exclude_unset=True, exclude_none=True)

  # Validate backup_directory server-side before persisting: the path must be
  # absolute, exist, and be writable. None is dropped above, so a client
  # clearing the field by sending null bypasses validation — that is acceptable
  # (the column is nullable and no directory operation will follow).
  if "backup_directory" in fields:
    directory: str = fields["backup_directory"]
    if directory:
      if not Path(directory).is_absolute():
        raise ValidationError("Backup directory must be an absolute path")
      if not Path(directory).is_dir():
        raise ValidationError("Backup directory does not exist")
      if not os.access(directory, os.W_OK):
        raise ValidationError("Backup directory is not writable")

  if fields:
    await preferences_repository.update(fields)
  return await preferences_repository.get()
