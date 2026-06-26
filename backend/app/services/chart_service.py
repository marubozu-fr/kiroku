"""Chart service — assembles candle chart data for a single trade (issue #189).

Orchestrates the trade repository, the parquet candle storage (candle_service)
and the Massive API client (massive_service) to build the payload consumed by
the frontend trade chart.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.errors import FuturesResolutionError, ValidationError
from app.models.asset import AssetCategory
from app.repositories import asset_repository, trade_repository
from app.services import (
  candle_service,
  futures_service,
  massive_service,
  trade_service,
)

logger = logging.getLogger(__name__)

# Supported chart resolutions. M1 is the stored (un-aggregated) timeframe.
RESOLUTIONS: tuple[str, ...] = ("M1", "M5", "M15", "H1", "H4", "D1")

# Map a trade's entry-timeframe token ('{value}{unit}', e.g. '15m') to a
# resolution. Unmapped tokens fall back to DEFAULT_RESOLUTION.
_TF_TOKEN_TO_RESOLUTION: dict[str, str] = {
  "1m": "M1",
  "5m": "M5",
  "15m": "M15",
  "1h": "H1",
  "4h": "H4",
  "1d": "D1",
}
DEFAULT_RESOLUTION = "M15"

# Number of days to load on each side of the trade date.
WINDOW_DAYS = 7

_MS_PER_DAY = 24 * 60 * 60 * 1000


def _resolve_timeframe(resolution: Optional[str], trade: dict[str, Any]) -> str:
  """Return a validated resolution string.

  When *resolution* is provided it is upper-cased and validated against
  RESOLUTIONS (raising ValidationError -> HTTP 400 otherwise). When omitted it
  is derived from the trade's entry timeframe, falling back to
  DEFAULT_RESOLUTION when that is unset or not mappable.
  """
  if resolution is not None:
    normalized = resolution.strip().upper()
    if normalized not in RESOLUTIONS:
      raise ValidationError(
        f"Invalid resolution '{resolution}'. Supported: {', '.join(RESOLUTIONS)}"
      )
    return normalized

  value = trade.get("timeframe_value")
  unit = trade.get("timeframe_unit")
  if value is not None and unit is not None:
    token = f"{value}{unit}".lower()
    return _TF_TOKEN_TO_RESOLUTION.get(token, DEFAULT_RESOLUTION)
  return DEFAULT_RESOLUTION


def _parse_date(value: str) -> datetime:
  """Parse an ISO date or datetime string into a UTC datetime."""
  parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
  if parsed.tzinfo is None:
    parsed = parsed.replace(tzinfo=timezone.utc)
  return parsed.astimezone(timezone.utc)


def _to_ms(moment: datetime) -> int:
  """Convert a datetime to Unix milliseconds."""
  return int(moment.timestamp() * 1000)


def _build_markers(activities: list[dict[str, Any]]) -> list[dict[str, Any]]:
  """Map trade activities to chart markers, skipping any without a date."""
  markers: list[dict[str, Any]] = []
  for activity in activities:
    date = activity.get("date")
    if not date:
      continue
    markers.append(
      {
        "timestamp": _to_ms(_parse_date(date)),
        "type": "entry" if activity.get("is_entry") else "exit",
        "side": activity["type"],
        "price": float(activity["price"]),
        "quantity": float(activity["quantity"]),
      }
    )
  return markers


def _to_storage_candles(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
  """Convert Massive candles ({o,h,l,c,v,t}) to storage shape."""
  return [
    {
      "timestamp": int(c["t"]),
      "open": float(c["o"]),
      "high": float(c["h"]),
      "low": float(c["l"]),
      "close": float(c["c"]),
      "volume": float(c["v"]),
    }
    for c in raw
  ]


async def get_trade_candles(
  trade_id: int, resolution: Optional[str] = None
) -> dict[str, Any]:
  """Build the candle chart payload for a trade.

  Returns a dict matching the TradeCandlesResponse envelope: a `data` key
  (None when the asset has no ticker) and a `meta` key (the reason `data` is
  null or candles are empty).

  Raises:
    TradeNotFoundError: when *trade_id* does not exist (-> HTTP 404).
    ValidationError:    when *resolution* is not recognised (-> HTTP 400).
  """
  trade = await trade_repository.get_trade_by_id(trade_id)
  if trade is None:
    raise trade_service.TradeNotFoundError(f"Trade {trade_id} not found")

  # Validate/derive the resolution before any I/O so a bad value fails fast.
  timeframe = _resolve_timeframe(resolution, trade)

  asset = (
    await asset_repository.get_by_id(trade["asset_id"])
    if trade.get("asset_id") is not None
    else None
  )
  ticker = asset.get("massive_ticker") if asset is not None else None
  if not ticker:
    return {"data": None, "meta": {"reason": "no_ticker"}}

  # Compute the [start, end] window around the trade date.
  trade_date = trade.get("trade_date")
  anchor = _parse_date(trade_date) if trade_date else datetime.now(timezone.utc)

  # Futures assets store a base product code (e.g. "NQ"); resolve the active
  # contract at the trade date before any candle lookup.
  if asset.get("category") == AssetCategory.futures.value:
    try:
      ticker = await futures_service.resolve_contract(ticker, anchor.date())
    except FuturesResolutionError as exc:
      logger.info("Futures contract resolution failed: %s", exc)
      return {"data": None, "meta": {"reason": "contract_unresolved"}}

  start_date = (anchor - timedelta(days=WINDOW_DAYS)).date()
  end_date = (anchor + timedelta(days=WINDOW_DAYS)).date()
  start_str = start_date.isoformat()
  end_str = end_date.isoformat()
  start_ts = _to_ms(datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc))
  # Include the full end day (inclusive upper bound).
  end_ts = (
    _to_ms(datetime(end_date.year, end_date.month, end_date.day, tzinfo=timezone.utc))
    + _MS_PER_DAY
    - 1
  )

  # Read stored M1 candles; lazily fetch from Massive when the range is empty.
  candles = candle_service.read_candles(ticker, start_ts, end_ts)
  if not candles:
    raw = await massive_service.fetch_candles(ticker, start_str, end_str)
    if raw:
      candle_service.store_candles(ticker, _to_storage_candles(raw))
      candles = candle_service.read_candles(ticker, start_ts, end_ts)

  if timeframe != "M1":
    candles = candle_service.aggregate_candles(candles, timeframe)

  activities = await trade_repository.get_activities(trade_id)
  markers = _build_markers(activities)

  data = {
    "ticker": ticker,
    "resolution": timeframe,
    "candles": candles,
    "markers": markers,
    "levels": {
      "stop_loss": trade.get("stop_loss"),
      # Trades carry no take-profit data in the schema; report none rather
      # than invent values.
      "take_profits": [],
    },
    "window": {"start": start_str, "end": end_str},
  }

  # Signal pending data when nothing is available for the range yet.
  meta = None if candles else {"reason": "pending"}
  return {"data": data, "meta": meta}
