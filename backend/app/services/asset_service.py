from datetime import datetime, timezone
from typing import Any

from app.models.asset import AssetCreate, AssetUpdate
from app.repositories import asset_repository


class AssetNotFoundError(Exception):
  """Raised when an asset id does not exist."""


class DuplicateAssetError(Exception):
  """Raised when an asset name is already taken."""


def _now() -> str:
  """Current UTC time as an ISO 8601 string."""
  return datetime.now(timezone.utc).isoformat()


async def list_assets(active_only: bool = False) -> list[dict[str, Any]]:
  return await asset_repository.get_all(active_only)


async def get_asset(asset_id: int) -> dict[str, Any]:
  asset = await asset_repository.get_by_id(asset_id)
  if asset is None:
    raise AssetNotFoundError(f"Asset {asset_id} not found")
  return asset


async def create_asset(payload: AssetCreate) -> dict[str, Any]:
  if await asset_repository.get_by_name(payload.name) is not None:
    raise DuplicateAssetError(f"Asset name '{payload.name}' already exists")
  new_id = await asset_repository.create(
    payload.name, payload.category, payload.currency, _now()
  )
  created = await asset_repository.get_by_id(new_id)
  # get_by_id cannot return None here: the row was just inserted.
  assert created is not None
  return created


async def update_asset(asset_id: int, payload: AssetUpdate) -> dict[str, Any]:
  existing = await asset_repository.get_by_id(asset_id)
  if existing is None:
    raise AssetNotFoundError(f"Asset {asset_id} not found")

  fields = payload.model_dump(exclude_unset=True)
  if not fields:
    return existing

  new_name = fields.get("name")
  if new_name is not None and new_name != existing["name"]:
    clashing = await asset_repository.get_by_name(new_name)
    if clashing is not None:
      raise DuplicateAssetError(f"Asset name '{new_name}' already exists")

  await asset_repository.update(asset_id, fields, _now())
  updated = await asset_repository.get_by_id(asset_id)
  assert updated is not None
  return updated


async def delete_asset(asset_id: int) -> dict[str, Any]:
  existing = await asset_repository.get_by_id(asset_id)
  if existing is None:
    raise AssetNotFoundError(f"Asset {asset_id} not found")
  await asset_repository.soft_delete(asset_id, _now())
  deleted = await asset_repository.get_by_id(asset_id)
  assert deleted is not None
  return deleted
