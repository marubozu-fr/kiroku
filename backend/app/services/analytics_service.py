from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from app.errors import ValidationError
from app.repositories import (
  emotion_repository,
  tag_repository,
  trade_repository,
)

EPS = 1e-9

# Minutes per duration unit, used to normalise the duration range filter.
_UNIT_MINUTES = {"minutes": 1, "hours": 60, "days": 1440}

# Fixed display order for the dynamic direction filter.
_DIRECTION_ORDER = ("Long", "Short")

# Account-type column values (lowercase) mapped to their UI labels.
_TYPE_LABELS = {"live": "Live", "demo": "Demo", "test": "Test"}


@dataclass
class TradeFilters:
  """Parsed, normalised filter criteria applied to a trade list."""

  date_from: Optional[str] = None
  date_to: Optional[str] = None
  asset_ids: list[int] = field(default_factory=list)
  directions: list[str] = field(default_factory=list)  # lowercased
  timeframes: list[str] = field(default_factory=list)  # lowercased tokens
  tag_ids: list[int] = field(default_factory=list)
  tags_logic: str = "AND"
  emotion_ids: list[int] = field(default_factory=list)
  types: list[str] = field(default_factory=list)  # lowercased
  include_missed: bool = False
  pnl_operator: Optional[str] = None
  pnl_value: Optional[float] = None
  duration_operator: Optional[str] = None
  duration_value: Optional[int] = None
  duration_unit: str = "minutes"


def _as_value(raw: Any) -> Any:
  """Unwrap an Enum to its value; pass anything else through unchanged."""
  return raw.value if isinstance(raw, Enum) else raw


def _parse_ints(raw: Optional[str], label: str) -> list[int]:
  """Parse a comma-separated integer string into a list of ints."""
  if not raw:
    return []
  try:
    return [int(part) for part in raw.split(",") if part.strip()]
  except ValueError:
    raise ValidationError(f"{label} must be a comma-separated list of integers")


def _parse_strs(raw: Optional[str]) -> list[str]:
  """Parse a comma-separated string into a list of trimmed, non-empty values."""
  if not raw:
    return []
  return [part.strip() for part in raw.split(",") if part.strip()]


def _timeframe_token(trade: dict[str, Any]) -> Optional[str]:
  """Combined entry-timeframe token (e.g. '15m'), or None when not set."""
  value = trade.get("timeframe_value")
  unit = trade.get("timeframe_unit")
  if value is None or unit is None:
    return None
  return f"{value}{unit}"


def build_trade_filters(params: dict[str, Any]) -> TradeFilters:
  """Parse raw query parameters into normalised filter criteria."""
  pnl_operator = _as_value(params.get("pnl_operator"))
  duration_operator = _as_value(params.get("duration_operator"))
  return TradeFilters(
    date_from=params.get("date_from"),
    date_to=params.get("date_to"),
    asset_ids=_parse_ints(params.get("asset_ids"), "asset_ids"),
    directions=[d.lower() for d in _parse_strs(params.get("direction"))],
    timeframes=[t.lower() for t in _parse_strs(params.get("entry_timeframe"))],
    tag_ids=_parse_ints(params.get("tag_ids"), "tag_ids"),
    tags_logic=_as_value(params.get("tags_logic")) or "AND",
    emotion_ids=_parse_ints(params.get("emotion_ids"), "emotion_ids"),
    types=[t.lower() for t in _parse_strs(params.get("types"))],
    include_missed=bool(params.get("include_missed", False)),
    pnl_operator=pnl_operator,
    pnl_value=params.get("pnl_value"),
    duration_operator=duration_operator,
    duration_value=params.get("duration_value"),
    duration_unit=_as_value(params.get("duration_unit")) or "minutes",
  )


def _apply_missed(trades: list[dict[str, Any]], include_missed: bool) -> list[dict[str, Any]]:
  """Drop missed-opportunity trades unless `include_missed` is set."""
  if include_missed:
    return trades
  return [t for t in trades if not t.get("missed_opportunity")]


def filter_trades(trades: list[dict[str, Any]], f: TradeFilters) -> list[dict[str, Any]]:
  """Apply every active filter dimension to the trade list."""
  result: list[dict[str, Any]] = []
  for t in trades:
    trade_day = (t.get("trade_date") or "")[:10]
    if f.date_from and trade_day < f.date_from:
      continue
    if f.date_to and trade_day > f.date_to:
      continue
    if f.asset_ids and t.get("asset_id") not in f.asset_ids:
      continue
    if f.directions and (t.get("direction") or "").lower() not in f.directions:
      continue
    if f.timeframes:
      token = _timeframe_token(t)
      if token is None or token.lower() not in f.timeframes:
        continue
    if f.tag_ids:
      trade_tags = set(t.get("tag_ids", []))
      if f.tags_logic == "OR":
        if trade_tags.isdisjoint(f.tag_ids):
          continue
      else:  # AND
        if not set(f.tag_ids).issubset(trade_tags):
          continue
    if f.emotion_ids:
      if set(t.get("emotion_ids", [])).isdisjoint(f.emotion_ids):
        continue
    if f.types and (t.get("account_type") or "").lower() not in f.types:
      continue
    if f.pnl_operator and f.pnl_value is not None:
      perf = t.get("performance_r")
      if perf is None:
        continue
      if f.pnl_operator == "gte" and perf < f.pnl_value:
        continue
      if f.pnl_operator == "lte" and perf > f.pnl_value:
        continue
    if f.duration_operator and f.duration_value is not None:
      minutes = t.get("duration_minutes")
      if minutes is None:
        continue
      threshold = f.duration_value * _UNIT_MINUTES[f.duration_unit]
      if f.duration_operator == "gte" and minutes < threshold:
        continue
      if f.duration_operator == "lte" and minutes > threshold:
        continue
    result.append(t)
  return result


def _streaks(scored: list[dict[str, Any]]) -> tuple[int, int]:
  """Longest winning and losing streaks over scored trades, by trade_date."""
  ordered = sorted(scored, key=lambda t: ((t.get("trade_date") or ""), t["id"]))
  win_streak = loss_streak = cur_win = cur_loss = 0
  for t in ordered:
    perf = t["performance_r"]
    if perf > EPS:
      cur_win += 1
      cur_loss = 0
    elif perf < -EPS:
      cur_loss += 1
      cur_win = 0
    else:
      cur_win = cur_loss = 0
    win_streak = max(win_streak, cur_win)
    loss_streak = max(loss_streak, cur_loss)
  return win_streak, loss_streak


def calculate_statistics(trades: list[dict[str, Any]]) -> dict[str, Any]:
  """Compute all KPIs over the filtered trades.

  Trades with a null performance_r count toward total_trades only; they are
  excluded from win/loss/avg calculations.
  """
  total_trades = len(trades)
  scored = [t for t in trades if t.get("performance_r") is not None]
  perfs = [t["performance_r"] for t in scored]
  n = len(perfs)

  winning = [r for r in perfs if r > EPS]
  losing = [r for r in perfs if r < -EPS]
  breakeven = [r for r in perfs if abs(r) <= EPS]

  total_pnl = round(sum(perfs), 2) if perfs else 0.0
  avg_pnl = round(sum(perfs) / n, 2) if n else 0.0
  win_rate = round(len(winning) / n * 100, 2) if n else 0.0

  avg_win_raw = sum(winning) / len(winning) if winning else 0.0
  avg_loss_raw = sum(abs(r) for r in losing) / len(losing) if losing else 0.0

  win_frac = len(winning) / n if n else 0.0
  loss_frac = len(losing) / n if n else 0.0
  expectancy = round((win_frac * avg_win_raw) - (loss_frac * avg_loss_raw), 2)

  total_losses = sum(abs(r) for r in losing)
  profit_factor = round(sum(winning) / total_losses, 2) if total_losses > EPS else None

  win_streak, loss_streak = _streaks(scored)

  durations = [
    t["duration_minutes"]
    for t in trades
    if t.get("activity_count", 0) >= 2 and t.get("duration_minutes") is not None
  ]
  avg_duration_hours = round(sum(durations) / len(durations) / 60, 2) if durations else 0.0

  return {
    "total_trades": total_trades,
    "winning_trades": len(winning),
    "losing_trades": len(losing),
    "breakeven_trades": len(breakeven),
    "total_pnl": total_pnl,
    "avg_pnl": avg_pnl,
    "win_rate": win_rate,
    "avg_win": round(avg_win_raw, 2),
    "avg_loss": round(avg_loss_raw, 2),
    "expectancy": expectancy,
    "profit_factor": profit_factor,
    "avg_duration_hours": avg_duration_hours,
    "winning_streak": win_streak,
    "losing_streak": loss_streak,
    "best_trade": round(max(perfs), 2) if perfs else None,
    "worst_trade": round(min(perfs), 2) if perfs else None,
  }


def get_available_filters(
  trades: list[dict[str, Any]],
  tag_names: dict[int, str],
  emotion_names: dict[int, str],
) -> dict[str, Any]:
  """Return the distinct filter values actually present in `trades`."""
  assets: dict[int, dict[str, Any]] = {}
  directions: set[str] = set()
  timeframes: set[str] = set()
  tag_ids: set[int] = set()
  emotion_ids: set[int] = set()
  types: set[str] = set()
  dates: list[str] = []

  for t in trades:
    asset_id = t.get("asset_id")
    if asset_id is not None and asset_id not in assets:
      assets[asset_id] = {
        "id": asset_id,
        "name": t.get("asset_name") or "",
        "currency": t.get("asset_currency"),
      }
    if t.get("direction"):
      directions.add(t["direction"])
    token = _timeframe_token(t)
    if token is not None:
      timeframes.add(token)
    tag_ids.update(t.get("tag_ids", []))
    emotion_ids.update(t.get("emotion_ids", []))
    account_type = t.get("account_type")
    if account_type:
      types.add(account_type.lower())
    trade_day = (t.get("trade_date") or "")[:10]
    if trade_day:
      dates.append(trade_day)

  return {
    "assets": sorted(assets.values(), key=lambda a: a["name"]),
    "directions": [d for d in _DIRECTION_ORDER if d in directions],
    "timeframes": sorted(timeframes),
    "tags": sorted(
      ({"id": tid, "name": tag_names.get(tid, "")} for tid in tag_ids),
      key=lambda x: x["name"],
    ),
    "emotions": sorted(
      ({"id": eid, "name": emotion_names.get(eid, "")} for eid in emotion_ids),
      key=lambda x: x["name"],
    ),
    "types": [_TYPE_LABELS[t] for t in _TYPE_LABELS if t in types],
    "date_range": {
      "min": min(dates) if dates else None,
      "max": max(dates) if dates else None,
    },
  }


async def _load_trades() -> list[dict[str, Any]]:
  """Load all trades joined with asset info and their tag/emotion ids + duration."""
  trades = await trade_repository.list_with_asset()

  tags_by_trade: dict[int, list[int]] = {}
  for row in await trade_repository.all_trade_tags():
    tags_by_trade.setdefault(row["trade_id"], []).append(row["tag_id"])

  emotions_by_trade: dict[int, list[int]] = {}
  for row in await trade_repository.all_trade_emotions():
    emotions_by_trade.setdefault(row["trade_id"], []).append(row["emotion_id"])

  durations_by_trade = {
    row["trade_id"]: row for row in await trade_repository.all_trade_durations()
  }

  for t in trades:
    t["tag_ids"] = tags_by_trade.get(t["id"], [])
    t["emotion_ids"] = emotions_by_trade.get(t["id"], [])
    duration = durations_by_trade.get(t["id"])
    t["duration_minutes"] = duration["duration_minutes"] if duration else None
    t["activity_count"] = duration["activity_count"] if duration else 0

  return trades


async def _reference_names() -> tuple[dict[int, str], dict[int, str]]:
  """Return id->name maps for all tags and emotions."""
  tag_names = {t["id"]: t["name"] for t in await tag_repository.get_all()}
  emotion_names = {e["id"]: e["name"] for e in await emotion_repository.get_all()}
  return tag_names, emotion_names


async def get_statistics(params: dict[str, Any]) -> dict[str, Any]:
  """Compute statistics and available filters for the given query params."""
  trades = await _load_trades()
  filters = build_trade_filters(params)
  base = _apply_missed(trades, filters.include_missed)

  tag_names, emotion_names = await _reference_names()
  available = get_available_filters(base, tag_names, emotion_names)

  filtered = filter_trades(base, filters)
  statistics = calculate_statistics(filtered)

  return {"statistics": statistics, "available_filters": available}


def _sort_key(sort_by: str):
  """Return a sort key function that places nulls last regardless of order."""
  if sort_by == "trade_date":
    return lambda t: ((t.get("trade_date") or ""), t["id"])
  if sort_by == "duration":
    return lambda t: (
      t.get("duration_minutes") if t.get("duration_minutes") is not None else float("-inf"),
      t["id"],
    )
  # performance_r
  return lambda t: (
    t.get("performance_r") if t.get("performance_r") is not None else float("-inf"),
    t["id"],
  )


def _trade_item(t: dict[str, Any]) -> dict[str, Any]:
  """Shape a trade row for the analytics list response."""
  minutes = t.get("duration_minutes")
  return {
    "id": t["id"],
    "asset_id": t.get("asset_id"),
    "asset_name": t.get("asset_name"),
    "asset_currency": t.get("asset_currency"),
    "account_type": t["account_type"],
    "status": t["status"],
    "direction": t.get("direction"),
    "performance_r": t.get("performance_r"),
    "timeframe_unit": t.get("timeframe_unit"),
    "timeframe_value": t.get("timeframe_value"),
    "trade_date": t.get("trade_date"),
    "duration_minutes": round(minutes, 2) if minutes is not None else None,
    "missed_opportunity": bool(t.get("missed_opportunity")),
  }


async def get_trades(
  params: dict[str, Any],
  page: int,
  per_page: int,
  sort_by: str,
  sort_order: str,
) -> dict[str, Any]:
  """Return the filtered, sorted, paginated trade list for the given params."""
  trades = await _load_trades()
  filters = build_trade_filters(params)
  base = _apply_missed(trades, filters.include_missed)
  filtered = filter_trades(base, filters)

  ordered = sorted(filtered, key=_sort_key(sort_by), reverse=(sort_order == "desc"))

  total = len(ordered)
  total_pages = (total + per_page - 1) // per_page if total else 0
  start = (page - 1) * per_page
  items = ordered[start:start + per_page]

  return {
    "trades": [_trade_item(t) for t in items],
    "pagination": {
      "page": page,
      "per_page": per_page,
      "total": total,
      "total_pages": total_pages,
    },
  }
