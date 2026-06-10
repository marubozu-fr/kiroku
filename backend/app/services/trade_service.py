import shutil
from datetime import datetime, timezone
from typing import Any, Optional

from app.database import SCREENSHOTS_DIR, database
from app.errors import NotFoundError
from app.models.trade import TradeCreate, TradeUpdate
from app.repositories import trade_repository

EPS = 1e-9


class TradeNotFoundError(NotFoundError):
  """Raised when a trade id does not exist."""


class TradeRelatedEntityError(NotFoundError):
  """Raised when a referenced entity (asset, tag, emotion) does not exist."""


def _now() -> str:
  """Current UTC time as an ISO 8601 string."""
  return datetime.now(timezone.utc).isoformat()


def _compute_metrics(
  activities: list[dict[str, Any]],
  stop_loss: Optional[float],
) -> dict[str, Any]:
  """Derive computed trade fields from a list of activity dicts.

  Each dict must have keys: type (str), price (float), quantity (float), date (str).
  Returns a dict with: direction, trade_date, avg_entry_price, avg_exit_price,
  risk, reward, performance_r, status, and an `is_entry` key for
  each activity (activities list is mutated in-place to add is_entry).
  """
  sorted_activities = sorted(activities, key=lambda a: a["date"])
  first = sorted_activities[0]

  direction = "Long" if first["type"] == "Buy" else "Short"
  trade_date = first["date"]
  entry_type: str = first["type"]
  exit_type: str = "Sell" if entry_type == "Buy" else "Buy"

  entries = [a for a in sorted_activities if a["type"] == entry_type]
  exits = [a for a in sorted_activities if a["type"] == exit_type]

  # Mark each activity with is_entry.
  entry_type_set = {entry_type}
  for activity in activities:
    activity["is_entry"] = activity["type"] in entry_type_set

  # Weighted-average entry price (always has at least one entry).
  entry_total_qty = sum(a["quantity"] for a in entries)
  avg_entry_price: float = sum(a["price"] * a["quantity"] for a in entries) / entry_total_qty

  # Weighted-average exit price (None when there are no exits yet).
  avg_exit_price: Optional[float]
  if exits:
    exit_total_qty = sum(a["quantity"] for a in exits)
    avg_exit_price = sum(a["price"] * a["quantity"] for a in exits) / exit_total_qty
  else:
    exit_total_qty = 0.0
    avg_exit_price = None

  # Risk is a positive magnitude — the distance to the stop, i.e. the "1R" unit.
  risk: Optional[float] = abs(avg_entry_price - stop_loss) if stop_loss is not None else None

  # Reward is directional (signed): positive when the exit is in the trade's
  # favour, negative when it moved against it. A Long profits when price rises;
  # a Short profits when it falls. This makes performance_r a signed R multiple
  # (a losing trade shows a negative R, e.g. -1R), which is the trading-standard.
  reward: Optional[float]
  if avg_exit_price is not None:
    if direction == "Long":
      reward = avg_exit_price - avg_entry_price
    else:  # Short
      reward = avg_entry_price - avg_exit_price
  else:
    reward = None

  performance_r: Optional[float]
  if reward is not None and risk is not None and risk > EPS:
    performance_r = reward / risk
  else:
    performance_r = None

  # Status derivation.
  if exit_total_qty <= EPS:
    status = "Open"
  elif exit_total_qty + EPS < entry_total_qty:
    status = "Partial"
  else:
    # Fully exited.
    assert avg_exit_price is not None
    status = "Breakeven" if abs(avg_exit_price - avg_entry_price) <= EPS else "Closed"

  return {
    "direction": direction,
    "trade_date": trade_date,
    "avg_entry_price": avg_entry_price,
    "avg_exit_price": avg_exit_price,
    "risk": risk,
    "reward": reward,
    "performance_r": performance_r,
    "status": status,
  }


async def _validate_related_entities(
  asset_id: Optional[int],
  tag_ids: list[int],
  emotion_ids: list[int],
) -> None:
  """Raise TradeRelatedEntityError for any id that does not exist."""
  if asset_id is not None and not await trade_repository.asset_exists(asset_id):
    raise TradeRelatedEntityError(f"Asset {asset_id} not found")
  for tag_id in tag_ids:
    if not await trade_repository.tag_exists(tag_id):
      raise TradeRelatedEntityError(f"Tag {tag_id} not found")
  for emotion_id in emotion_ids:
    if not await trade_repository.emotion_exists(emotion_id):
      raise TradeRelatedEntityError(f"Emotion {emotion_id} not found")


async def _assemble_detail(trade_id: int) -> dict[str, Any]:
  """Fetch a trade row and all its children; return as a single dict."""
  trade = await trade_repository.get_trade_by_id(trade_id)
  assert trade is not None
  trade["activities"] = await trade_repository.get_activities(trade_id)
  trade["tags"] = await trade_repository.get_tags(trade_id)
  trade["emotions"] = await trade_repository.get_emotions(trade_id)
  trade["screenshots"] = await trade_repository.get_screenshots(trade_id)
  return trade


async def list_trades(
  year: Optional[int] = None,
  asset_id: Optional[int] = None,
  status: Optional[str] = None,
  direction: Optional[str] = None,
) -> list[dict[str, Any]]:
  return await trade_repository.list_trades(year=year, asset_id=asset_id, status=status, direction=direction)


async def list_years() -> list[int]:
  return await trade_repository.distinct_years()


async def get_trade(trade_id: int) -> dict[str, Any]:
  trade = await trade_repository.get_trade_by_id(trade_id)
  if trade is None:
    raise TradeNotFoundError(f"Trade {trade_id} not found")
  return await _assemble_detail(trade_id)


async def create_trade(payload: TradeCreate) -> dict[str, Any]:
  await _validate_related_entities(payload.asset_id, payload.tag_ids, payload.emotion_ids)

  # Convert activity models to plain dicts so _compute_metrics can mutate them.
  activities = [a.model_dump() for a in payload.activities]
  metrics = _compute_metrics(activities, payload.stop_loss)

  trade_fields: dict[str, Any] = {
    "asset_id": payload.asset_id,
    "account_type": payload.account_type,
    "stop_loss": payload.stop_loss,
    "notes": payload.notes,
    "missed_opportunity": payload.missed_opportunity,
    "risk_per_trade": payload.risk_per_trade,
    "timeframe_unit": payload.timeframe_unit,
    "timeframe_value": payload.timeframe_value,
    "status": metrics["status"],
    "direction": metrics["direction"],
    "trade_date": metrics["trade_date"],
    "avg_entry_price": metrics["avg_entry_price"],
    "avg_exit_price": metrics["avg_exit_price"],
    "risk": metrics["risk"],
    "reward": metrics["reward"],
    "performance_r": metrics["performance_r"],
  }

  now = _now()
  async with database.transaction():
    trade_id = await trade_repository.insert_trade(trade_fields, now)
    for activity in activities:
      await trade_repository.insert_activity(trade_id, activity)
    await trade_repository.set_tags(trade_id, payload.tag_ids)
    await trade_repository.set_emotions(trade_id, payload.emotion_ids)

  return await _assemble_detail(trade_id)


async def update_trade(trade_id: int, payload: TradeUpdate) -> dict[str, Any]:
  existing = await trade_repository.get_trade_by_id(trade_id)
  if existing is None:
    raise TradeNotFoundError(f"Trade {trade_id} not found")

  updates = payload.model_dump(exclude_unset=True)

  # Separate junction/activity fields from scalar trade fields.
  new_activities_raw: Optional[list[dict[str, Any]]] = None
  new_tag_ids: Optional[list[int]] = None
  new_emotion_ids: Optional[list[int]] = None

  if "activities" in updates:
    # Convert TradeActivityCreate models back to dicts (use_enum_values means they're already str).
    new_activities_raw = [a.model_dump() for a in payload.activities]  # type: ignore[union-attr]
    del updates["activities"]
  if "tag_ids" in updates:
    new_tag_ids = updates.pop("tag_ids")
  if "emotion_ids" in updates:
    new_emotion_ids = updates.pop("emotion_ids")

  # Validate any newly referenced entities.
  new_asset_id: Optional[int] = updates.get("asset_id")
  await _validate_related_entities(
    new_asset_id,
    new_tag_ids if new_tag_ids is not None else [],
    new_emotion_ids if new_emotion_ids is not None else [],
  )

  # Determine the final activities and stop_loss for metric recomputation.
  if new_activities_raw is not None:
    final_activities = new_activities_raw
  else:
    # Load current activities from DB.
    current_activities = await trade_repository.get_activities(trade_id)
    final_activities = current_activities

  final_stop_loss: Optional[float]
  if "stop_loss" in updates:
    final_stop_loss = updates["stop_loss"]
  else:
    final_stop_loss = existing.get("stop_loss")

  metrics = _compute_metrics(final_activities, final_stop_loss)

  # Merge computed fields into the scalar update dict.
  scalar_updates = {**updates}
  computed_keys = (
    "status", "direction", "trade_date", "avg_entry_price", "avg_exit_price",
    "risk", "reward", "performance_r",
  )
  for key in computed_keys:
    scalar_updates[key] = metrics[key]

  now = _now()
  async with database.transaction():
    if scalar_updates:
      await trade_repository.update_trade(trade_id, scalar_updates, now)
    if new_activities_raw is not None:
      await trade_repository.replace_activities(trade_id, final_activities)
    if new_tag_ids is not None:
      await trade_repository.set_tags(trade_id, new_tag_ids)
    if new_emotion_ids is not None:
      await trade_repository.set_emotions(trade_id, new_emotion_ids)

  return await _assemble_detail(trade_id)


async def delete_trade(trade_id: int) -> dict[str, Any]:
  existing = await trade_repository.get_trade_by_id(trade_id)
  if existing is None:
    raise TradeNotFoundError(f"Trade {trade_id} not found")
  detail = await _assemble_detail(trade_id)
  # Remove the trade's screenshot files from disk. The DB rows cascade via FK,
  # but the files on disk do not, so clean up the directory first.
  shutil.rmtree(SCREENSHOTS_DIR / str(trade_id), ignore_errors=True)
  await trade_repository.delete_trade(trade_id)
  return detail
