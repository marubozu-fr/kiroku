from datetime import datetime, timezone
from typing import Any

from app.errors import DuplicateError, NotFoundError
from app.models.tag import TagCreate, TagUpdate
from app.repositories import tag_repository


class TagNotFoundError(NotFoundError):
  """Raised when a tag id does not exist."""


class DuplicateTagError(DuplicateError):
  """Raised when a tag name is already taken."""


def _now() -> str:
  """Current UTC time as an ISO 8601 string."""
  return datetime.now(timezone.utc).isoformat()


async def list_tags(active_only: bool = False) -> list[dict[str, Any]]:
  return await tag_repository.get_all(active_only)


async def get_tag(tag_id: int) -> dict[str, Any]:
  tag = await tag_repository.get_by_id(tag_id)
  if tag is None:
    raise TagNotFoundError(f"Tag {tag_id} not found")
  return tag


async def create_tag(payload: TagCreate) -> dict[str, Any]:
  if await tag_repository.get_by_name(payload.name) is not None:
    raise DuplicateTagError(f"Tag name '{payload.name}' already exists")
  new_id = await tag_repository.create(payload.name, payload.description, _now())
  created = await tag_repository.get_by_id(new_id)
  # get_by_id cannot return None here: the row was just inserted.
  assert created is not None
  return created


async def update_tag(tag_id: int, payload: TagUpdate) -> dict[str, Any]:
  existing = await tag_repository.get_by_id(tag_id)
  if existing is None:
    raise TagNotFoundError(f"Tag {tag_id} not found")

  fields = payload.model_dump(exclude_unset=True)
  if not fields:
    return existing

  new_name = fields.get("name")
  if new_name is not None and new_name != existing["name"]:
    clashing = await tag_repository.get_by_name(new_name)
    if clashing is not None:
      raise DuplicateTagError(f"Tag name '{new_name}' already exists")

  await tag_repository.update(tag_id, fields, _now())
  updated = await tag_repository.get_by_id(tag_id)
  assert updated is not None
  return updated


async def delete_tag(tag_id: int) -> dict[str, Any]:
  existing = await tag_repository.get_by_id(tag_id)
  if existing is None:
    raise TagNotFoundError(f"Tag {tag_id} not found")
  await tag_repository.soft_delete(tag_id, _now())
  deleted = await tag_repository.get_by_id(tag_id)
  assert deleted is not None
  return deleted
