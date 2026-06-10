from typing import Any

from app.models.preferences import PreferencesUpdate
from app.repositories import preferences_repository


async def get_preferences() -> dict[str, Any]:
  return await preferences_repository.get()


async def update_preferences(payload: PreferencesUpdate) -> dict[str, Any]:
  # Partial update: only the fields the client actually sent are written.
  # None values are dropped too — the columns are NOT NULL.
  fields = payload.model_dump(exclude_unset=True, exclude_none=True)
  if fields:
    await preferences_repository.update(fields)
  return await preferences_repository.get()
