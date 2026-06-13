from datetime import datetime, timezone
from typing import Any, Optional

from app.database import database
from app.errors import DuplicateError, NotFoundError
from app.models.emotion import EmotionBulkCreate, EmotionCategory, EmotionCreate, EmotionUpdate
from app.repositories import emotion_repository


class EmotionNotFoundError(NotFoundError):
  """Raised when an emotion id does not exist."""


def _now() -> str:
  """Current UTC time as an ISO 8601 string."""
  return datetime.now(timezone.utc).isoformat()


async def list_emotions(category: Optional[str] = None) -> list[dict[str, Any]]:
  return await emotion_repository.get_all(category)


async def group_emotions() -> dict[str, list[dict[str, Any]]]:
  """Return all emotions keyed by category, including empty categories."""
  emotions = await emotion_repository.get_all()
  grouped: dict[str, list[dict[str, Any]]] = {category.value: [] for category in EmotionCategory}
  for emotion in emotions:
    # An emotion's category always matches a known enum value (enforced on write).
    grouped.setdefault(emotion["category"], []).append(emotion)
  return grouped


async def get_emotion(emotion_id: int) -> dict[str, Any]:
  emotion = await emotion_repository.get_by_id(emotion_id)
  if emotion is None:
    raise EmotionNotFoundError(f"Emotion {emotion_id} not found")
  return emotion


async def create_emotion(payload: EmotionCreate) -> dict[str, Any]:
  new_id = await emotion_repository.create(
    payload.name, payload.description, payload.severity, payload.category, _now()
  )
  created = await emotion_repository.get_by_id(new_id)
  # get_by_id cannot return None here: the row was just inserted.
  assert created is not None
  return created


async def update_emotion(emotion_id: int, payload: EmotionUpdate) -> dict[str, Any]:
  existing = await emotion_repository.get_by_id(emotion_id)
  if existing is None:
    raise EmotionNotFoundError(f"Emotion {emotion_id} not found")

  fields = payload.model_dump(exclude_unset=True)
  if not fields:
    return existing

  await emotion_repository.update(emotion_id, fields, _now())
  updated = await emotion_repository.get_by_id(emotion_id)
  assert updated is not None
  return updated


async def count_trades(emotion_id: int) -> int:
  existing = await emotion_repository.get_by_id(emotion_id)
  if existing is None:
    raise EmotionNotFoundError(f"Emotion {emotion_id} not found")
  return await emotion_repository.count_trades(emotion_id)


async def bulk_create_emotions(payload: EmotionBulkCreate) -> list[dict[str, Any]]:
  """Validate all, check for duplicates vs DB, insert atomically."""
  names = [e.name for e in payload.emotions]
  existing = await emotion_repository.get_existing_names(names)
  if existing:
    raise DuplicateError(f"Emotion name(s) already exist: {', '.join(existing)}")
  now = _now()
  tuples = [
    (e.name, e.description, e.severity, e.category)
    for e in payload.emotions
  ]
  async with database.transaction():
    ids = await emotion_repository.create_bulk(tuples, now)
  results: list[dict[str, Any]] = []
  for new_id in ids:
    row = await emotion_repository.get_by_id(new_id)
    assert row is not None
    results.append(row)
  return results


async def delete_emotion(emotion_id: int) -> None:
  existing = await emotion_repository.get_by_id(emotion_id)
  if existing is None:
    raise EmotionNotFoundError(f"Emotion {emotion_id} not found")
  async with database.transaction():
    await emotion_repository.delete(emotion_id)
