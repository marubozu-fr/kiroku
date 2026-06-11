from dataclasses import dataclass, field
from datetime import datetime
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


# ---------------------------------------------------------------------------
# Breakdown helpers
# ---------------------------------------------------------------------------

# Fixed English weekday names in ISO order (Monday = 0).
_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

# R-distribution bucket definitions: (label, min_val, max_val).
# Bucketing convention: [min_val, max_val) — min inclusive, max exclusive.
# Overflow buckets use None for the unbounded edge.
_R_BUCKETS: list[tuple[str, Optional[float], Optional[float]]] = [
  ("< -3.0", None, -3.0),
  ("-3.0 to -2.5", -3.0, -2.5),
  ("-2.5 to -2.0", -2.5, -2.0),
  ("-2.0 to -1.5", -2.0, -1.5),
  ("-1.5 to -1.0", -1.5, -1.0),
  ("-1.0 to -0.5", -1.0, -0.5),
  ("-0.5 to 0.0", -0.5, 0.0),
  ("0.0 to 0.5", 0.0, 0.5),
  ("0.5 to 1.0", 0.5, 1.0),
  ("1.0 to 1.5", 1.0, 1.5),
  ("1.5 to 2.0", 1.5, 2.0),
  ("2.0 to 2.5", 2.0, 2.5),
  ("2.5 to 3.0", 2.5, 3.0),
  ("3.0+", 3.0, None),
]


def _group_stats(trades: list[dict[str, Any]]) -> dict[str, Any]:
  """Compute per-group breakdown stats mirroring calculate_statistics math.

  total_trades counts ALL trades in the group. win/loss/breakeven/pnl/avg/win_rate
  are computed over the scored subset (non-null performance_r) only.
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

  total_losses = sum(abs(r) for r in losing)
  profit_factor: Optional[float] = (
    round(sum(winning) / total_losses, 2) if total_losses > EPS else None
  )

  return {
    "total_trades": total_trades,
    "winning_trades": len(winning),
    "losing_trades": len(losing),
    "breakeven_trades": len(breakeven),
    "total_pnl": total_pnl,
    "win_rate": win_rate,
    "avg_pnl": avg_pnl,
    "profit_factor": profit_factor,
  }


def _by_asset(trades: list[dict[str, Any]]) -> list[dict[str, Any]]:
  """Group filtered trades by asset and compute per-asset stats."""
  groups: dict[int, list[dict[str, Any]]] = {}
  meta: dict[int, tuple[str, Optional[str]]] = {}  # asset_id -> (name, currency)
  for t in trades:
    aid = t.get("asset_id")
    if aid is None:
      continue
    groups.setdefault(aid, []).append(t)
    if aid not in meta:
      meta[aid] = (t.get("asset_name") or "", t.get("asset_currency"))

  result: list[dict[str, Any]] = []
  for aid, group in groups.items():
    name, currency = meta[aid]
    stats = _group_stats(group)
    result.append({
      "asset_id": aid,
      "asset_name": name,
      "asset_currency": currency,
      **stats,
    })

  result.sort(key=lambda x: (-x["total_trades"], x["asset_name"]))
  return result


def _by_tag(
  trades: list[dict[str, Any]],
  tag_names: dict[int, str],
) -> list[dict[str, Any]]:
  """Group filtered trades by tag (a trade with N tags counts in each group)."""
  groups: dict[int, list[dict[str, Any]]] = {}
  for t in trades:
    for tid in t.get("tag_ids", []):
      groups.setdefault(tid, []).append(t)

  result: list[dict[str, Any]] = []
  for tid, group in groups.items():
    stats = _group_stats(group)
    result.append({
      "tag_id": tid,
      "tag_name": tag_names.get(tid, ""),
      **stats,
    })

  result.sort(key=lambda x: (-x["total_trades"], x["tag_name"]))
  return result


def _by_day_hour(trades: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
  """Build a day-of-week x hour matrix from trade_date timestamps.

  Outer keys are English weekday names (Monday..Sunday).
  Inner keys are the hour as a string ("0".."23").
  Only cells with at least one trade are included.
  """
  # cells[weekday_name][hour_str] -> {all: list, scored: list, winning: list, perfs: list}
  cells: dict[str, dict[str, dict[str, Any]]] = {}

  for t in trades:
    raw_date = t.get("trade_date") or ""
    if not raw_date:
      continue
    try:
      dt = datetime.fromisoformat(raw_date)
    except ValueError:
      continue
    day_name = _WEEKDAYS[dt.weekday()]
    hour_str = str(dt.hour)

    if day_name not in cells:
      cells[day_name] = {}
    if hour_str not in cells[day_name]:
      cells[day_name][hour_str] = {"total": 0, "scored": [], "winning": 0, "pnl": 0.0}

    cell = cells[day_name][hour_str]
    cell["total"] += 1
    perf = t.get("performance_r")
    if perf is not None:
      cell["scored"].append(perf)
      if perf > EPS:
        cell["winning"] += 1
      cell["pnl"] += perf

  result: dict[str, dict[str, Any]] = {}
  for day_name in _WEEKDAYS:
    if day_name not in cells:
      continue
    result[day_name] = {}
    for hour_str, cell in cells[day_name].items():
      scored_n = len(cell["scored"])
      win_rate = round(cell["winning"] / scored_n * 100, 2) if scored_n else 0.0
      result[day_name][hour_str] = {
        "total_trades": cell["total"],
        "winning_trades": cell["winning"],
        "total_pnl": round(cell["pnl"], 2),
        "win_rate": win_rate,
      }

  return result


def _r_distribution(trades: list[dict[str, Any]]) -> list[dict[str, Any]]:
  """Build fixed R-distribution histogram over scored trades.

  Bucketing uses [min, max) — min-inclusive, max-exclusive convention.
  The first bucket ("< -3.0") captures all values below -3.0.
  The last bucket ("3.0+") captures all values >= 3.0.
  """
  counts = {label: 0 for label, _, _ in _R_BUCKETS}

  for t in trades:
    perf = t.get("performance_r")
    if perf is None:
      continue
    for label, lo, hi in _R_BUCKETS:
      # Lower-overflow bucket: no lower bound — catches perf < -3.0.
      if lo is None:
        if perf < hi:  # type: ignore[operator]
          counts[label] += 1
          break
      # Upper-overflow bucket: no upper bound — catches perf >= 3.0.
      elif hi is None:
        if perf >= lo:
          counts[label] += 1
          break
      # Normal [lo, hi) bucket.
      else:
        if lo <= perf < hi:
          counts[label] += 1
          break

  return [
    {"bucket": label, "min": lo, "max": hi, "count": counts[label]}
    for label, lo, hi in _R_BUCKETS
  ]


def _cumulative_r(trades: list[dict[str, Any]]) -> list[dict[str, Any]]:
  """Build a chronological cumulative R curve over scored trades.

  Trades with null performance_r are excluded entirely.
  Sorted by trade_date ASC, then trade id ASC (same tie-break as _streaks).
  """
  scored = [t for t in trades if t.get("performance_r") is not None]
  ordered = sorted(scored, key=lambda t: ((t.get("trade_date") or ""), t["id"]))

  result: list[dict[str, Any]] = []
  running = 0.0
  for t in ordered:
    perf = round(t["performance_r"], 2)
    running = round(running + perf, 2)
    result.append({
      "trade_date": t.get("trade_date") or "",
      "trade_id": t["id"],
      "performance_r": perf,
      "cumulative_r": running,
    })

  return result


async def get_breakdowns(params: dict[str, Any]) -> dict[str, Any]:
  """Compute all analytics breakdowns for the given query params.

  Mirrors get_statistics: load → build filters → apply missed → filter → compute.
  """
  trades = await _load_trades()
  filters = build_trade_filters(params)
  base = _apply_missed(trades, filters.include_missed)
  filtered = filter_trades(base, filters)

  tag_names, _ = await _reference_names()

  return {
    "by_asset": _by_asset(filtered),
    "by_tag": _by_tag(filtered, tag_names),
    "by_day_hour": _by_day_hour(filtered),
    "r_distribution": _r_distribution(filtered),
    "cumulative_r": _cumulative_r(filtered),
  }


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


def _trade_item(
  t: dict[str, Any],
  tag_names: dict[int, str],
  emotion_info: dict[int, dict[str, str]],
) -> dict[str, Any]:
  """Shape a trade row for the analytics list response."""
  minutes = t.get("duration_minutes")
  tags = sorted(
    [{"id": tid, "name": tag_names.get(tid, "")} for tid in t.get("tag_ids", [])],
    key=lambda x: x["name"],
  )
  emotions = sorted(
    [
      {"id": eid, "name": emotion_info[eid]["name"], "severity": emotion_info[eid]["severity"]}
      for eid in t.get("emotion_ids", [])
      if eid in emotion_info
    ],
    key=lambda x: x["name"],
  )
  return {
    "id": t["id"],
    "asset_id": t.get("asset_id"),
    "asset_name": t.get("asset_name"),
    "asset_currency": t.get("asset_currency"),
    "account_type": t["account_type"],
    "status": t["status"],
    "direction": t.get("direction"),
    "tags": tags,
    "emotions": emotions,
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

  tag_names = {row["id"]: row["name"] for row in await tag_repository.get_all()}
  emotion_info = {
    row["id"]: {"name": row["name"], "severity": row["severity"]}
    for row in await emotion_repository.get_all()
  }

  return {
    "trades": [_trade_item(t, tag_names, emotion_info) for t in items],
    "pagination": {
      "page": page,
      "per_page": per_page,
      "total": total,
      "total_pages": total_pages,
    },
  }
