from datetime import datetime, timezone
from typing import Any, Optional

from app.repositories import trade_repository

EPS = 1e-9

_MONTH_LABELS = (
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)


def _now() -> datetime:
  """Current UTC time. Isolated so date-dependent logic is easy to reason about."""
  return datetime.now(timezone.utc)


def _risk(trade: dict[str, Any]) -> float:
  """Per-trade risk weighting for percentage conversion (defaults to 1.0)."""
  risk = trade.get("risk_per_trade")
  return risk if risk is not None else 1.0


def _month_index(year: int, month: int) -> int:
  """Absolute month number, so month ranges are simple integer arithmetic."""
  return year * 12 + (month - 1)


def _from_index(index: int) -> tuple[int, int]:
  """Inverse of `_month_index`: absolute month number back to (year, month)."""
  return index // 12, index % 12 + 1


def _shift_years(now: datetime, delta: int) -> str:
  """Return `now` shifted by `delta` years as a YYYY-MM-DD string (clamps Feb 29)."""
  year = now.year + delta
  try:
    shifted = now.replace(year=year)
  except ValueError:
    # now is Feb 29 and the target year is not a leap year.
    shifted = now.replace(year=year, day=28)
  return shifted.strftime("%Y-%m-%d")


def _period_start(period: str, now: datetime) -> Optional[str]:
  """Inclusive lower bound on trade_date for the given period (None = no bound)."""
  if period == "ytd":
    return f"{now.year:04d}-01-01"
  if period == "1y":
    return _shift_years(now, -1)
  if period == "5y":
    return _shift_years(now, -5)
  return None  # all


def _compute_stats(scored: list[dict[str, Any]]) -> dict[str, Any]:
  """Aggregate statistics over trades that have a non-null performance_r."""
  perfs = [t["performance_r"] for t in scored]
  n = len(perfs)
  if n == 0:
    return {
      "total_trades": 0,
      "win_rate": 0.0,
      "avg_r": 0.0,
      "profit_factor": 0.0,
      "best_r": None,
      "worst_r": None,
      "total_r": 0.0,
      "total_pct": 0.0,
    }

  wins = [r for r in perfs if r > EPS]
  losses = [r for r in perfs if r < -EPS]
  total_r = sum(perfs)

  if not wins:
    profit_factor = 0.0
  elif not losses:
    profit_factor = 999.0
  else:
    profit_factor = round(sum(wins) / abs(sum(losses)), 2)

  total_pct = sum(t["performance_r"] * _risk(t) for t in scored)

  return {
    "total_trades": n,
    "win_rate": round(len(wins) / n * 100, 2),
    "avg_r": round(total_r / n, 2),
    "profit_factor": profit_factor,
    "best_r": round(max(perfs), 2),
    "worst_r": round(min(perfs), 2),
    "total_r": round(total_r, 2),
    "total_pct": round(total_pct, 2),
  }


def _month_range(
  period: str, now: datetime, scored: list[dict[str, Any]]
) -> list[tuple[int, int]]:
  """Ordered list of (year, month) the monthly series must cover for the period."""
  end = _month_index(now.year, now.month)

  first_index: Optional[int] = None
  if scored:
    first = min(t["trade_date"] for t in scored)
    first_index = _month_index(int(first[:4]), int(first[5:7]))

  if period == "ytd":
    start = _month_index(now.year, 1)
  elif period == "1y":
    start = end - 11
  elif period == "5y":
    start = end - 59
    if first_index is not None and first_index > start:
      start = first_index
  else:  # all
    if first_index is None:
      return []
    start = first_index

  return [_from_index(i) for i in range(start, end + 1)]


def _compute_monthly(
  scored: list[dict[str, Any]], period: str, now: datetime
) -> list[dict[str, Any]]:
  """Per-month aggregation, zero-filled across the full period range."""
  buckets: dict[tuple[int, int], dict[str, float]] = {}
  for trade in scored:
    date = trade["trade_date"]
    key = (int(date[:4]), int(date[5:7]))
    bucket = buckets.setdefault(key, {"value_r": 0.0, "value_pct": 0.0, "trade_count": 0})
    bucket["value_r"] += trade["performance_r"]
    bucket["value_pct"] += trade["performance_r"] * _risk(trade)
    bucket["trade_count"] += 1

  empty = {"value_r": 0.0, "value_pct": 0.0, "trade_count": 0}
  result: list[dict[str, Any]] = []
  for year, month in _month_range(period, now, scored):
    bucket = buckets.get((year, month), empty)
    result.append({
      "year": year,
      "month": month,
      "month_label": _MONTH_LABELS[month - 1],
      "value_r": round(bucket["value_r"], 2),
      "value_pct": round(bucket["value_pct"], 2),
      "trade_count": int(bucket["trade_count"]),
    })
  return result


def _compute_equity(scored: list[dict[str, Any]]) -> list[dict[str, Any]]:
  """Running cumulative R and % curve, one point per scored trade (chronological)."""
  ordered = sorted(scored, key=lambda t: (t["trade_date"], t["id"]))
  cumulative_r = 0.0
  cumulative_pct = 0.0
  points: list[dict[str, Any]] = []
  for trade in ordered:
    cumulative_r += trade["performance_r"]
    cumulative_pct += trade["performance_r"] * _risk(trade)
    points.append({
      "date": trade["trade_date"],
      "cumulative_r": round(cumulative_r, 2),
      "cumulative_pct": round(cumulative_pct, 2),
      "trade_id": trade["id"],
    })
  return points


def _recent_item(trade: dict[str, Any]) -> dict[str, Any]:
  """Shape a trade row for the recent-activity list."""
  performance_r = trade.get("performance_r")
  performance_pct = performance_r * _risk(trade) if performance_r is not None else None
  return {
    "id": trade["id"],
    "asset_name": trade.get("asset_name"),
    "asset_currency": trade.get("asset_currency"),
    "direction": trade.get("direction"),
    "status": trade["status"],
    "performance_r": performance_r,
    "performance_pct": performance_pct,
    "trade_date": trade.get("trade_date"),
  }


async def get_dashboard(period: str, account_type: str) -> dict[str, Any]:
  """Assemble the full dashboard payload for the given period and account type."""
  now = _now()
  start_date = _period_start(period, now)
  account_filter = None if account_type == "all" else account_type

  trades = await trade_repository.list_with_asset(
    account_type=account_filter, start_date=start_date
  )
  # Stats, monthly and equity ignore missed opportunities and unresolved trades.
  scored = [
    t for t in trades
    if not t["missed_opportunity"] and t.get("performance_r") is not None
  ]

  recent = await trade_repository.list_recent_with_asset(
    account_type=account_filter, limit=10
  )

  return {
    "stats": _compute_stats(scored),
    "monthly": _compute_monthly(scored, period, now),
    "equity": _compute_equity(scored),
    "recent_trades": [_recent_item(t) for t in recent],
  }
