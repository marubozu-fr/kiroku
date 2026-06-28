import os
from pathlib import Path
from typing import Any

from app.errors import ValidationError
from app.models.preferences import PreferencesUpdate
from app.repositories import preferences_repository
from app.services.chart_service import (
  CHART_TIMEFRAMES_WARNING_THRESHOLD,
  VALID_TIMEFRAME_UNITS,
  validate_chart_timeframes,
)

# Preference keys whose column is nullable and whose None value must therefore
# be written through (to clear the stored value) rather than dropped.
_NULLABLE_WRITE_THROUGH: frozenset[str] = frozenset(
  {"entry_timeframe_unit_default", "entry_timeframe_value_default"}
)


def _validate_entry_timeframe_pair(unit: Any, value: Any) -> None:
  """Raise ValidationError when an entry-timeframe pair has invalid values."""
  if unit is not None and unit not in VALID_TIMEFRAME_UNITS:
    raise ValidationError(
      f"Invalid timeframe unit '{unit}'. Valid units: m, h, D, W"
    )
  if value is not None:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
      raise ValidationError(
        f"Timeframe value must be a positive integer, got {value!r}"
      )


async def get_preferences() -> dict[str, Any]:
  prefs = await preferences_repository.get()
  prefs["chart_timeframes_warning_threshold"] = CHART_TIMEFRAMES_WARNING_THRESHOLD
  return prefs


async def update_preferences(payload: PreferencesUpdate) -> dict[str, Any]:
  # Capture every field the client explicitly set (including explicit nulls).
  set_fields = payload.model_dump(exclude_unset=True)

  # Build the dict to persist: drop None for NOT NULL columns, but preserve
  # None for nullable columns that support explicit clearing (entry timeframe).
  fields: dict[str, Any] = {
    k: v
    for k, v in set_fields.items()
    if v is not None or k in _NULLABLE_WRITE_THROUGH
  }

  # --- Validate backup_directory ---
  # None is dropped above for non-nullable fields, so a null sent by the client
  # bypasses this check — acceptable (the column is nullable and no directory
  # operation will follow).
  if "backup_directory" in fields:
    directory: str = fields["backup_directory"]
    if directory:
      if not Path(directory).is_absolute():
        raise ValidationError("Backup directory must be an absolute path")
      if not Path(directory).is_dir():
        raise ValidationError("Backup directory does not exist")
      if not os.access(directory, os.W_OK):
        raise ValidationError("Backup directory is not writable")

  # --- Validate chart_timeframes_default ---
  if "chart_timeframes_default" in set_fields:
    validate_chart_timeframes(set_fields["chart_timeframes_default"])

  # --- Validate entry-timeframe pair ---
  # The two fields must always be sent together: providing only one of them
  # would leave the stored pair in an inconsistent state.
  unit_set = "entry_timeframe_unit_default" in set_fields
  value_set = "entry_timeframe_value_default" in set_fields
  if unit_set != value_set:
    raise ValidationError(
      "entry_timeframe_unit_default and entry_timeframe_value_default "
      "must be provided together"
    )
  if unit_set and value_set:
    _validate_entry_timeframe_pair(
      set_fields["entry_timeframe_unit_default"],
      set_fields["entry_timeframe_value_default"],
    )

  if fields:
    await preferences_repository.update(fields)
  return await get_preferences()
