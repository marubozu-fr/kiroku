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

# Supported legacy chart resolutions. M1 is the stored (un-aggregated) timeframe.
# These coexist with free-form TradingView-casing tokens ('15m', '4h', '1D')
# accepted since issue #236.
RESOLUTIONS: tuple[str, ...] = ("M1", "M5", "M15", "H1", "H4", "D1")

# Soft cap on the number of configured chart timeframes. Past this the frontend
# shows a non-blocking warning; the backend enforces no hard limit (issue #235).
CHART_TIMEFRAMES_WARNING_THRESHOLD = 8

# Sort weight per timeframe unit, TradingView casing convention (issue #236):
# minutes < hours < days < weeks. Used to order resolved chart timeframes.
UNIT_WEIGHTS: dict[str, int] = {"m": 1, "h": 2, "D": 3, "W": 4}

# Valid timeframe unit characters; derived from UNIT_WEIGHTS so the two stay in
# sync. Same convention as preferences (issue #235).
VALID_TIMEFRAME_UNITS: frozenset[str] = frozenset(UNIT_WEIGHTS)

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

  When *resolution* is provided it is validated and returned. Both legacy tokens
  (case-insensitive: "M1", "M5", "H1", ...) and free-form TradingView-casing
  tokens ("15m", "4h", "1D", "2W") are accepted; anything else raises
  ValidationError (-> HTTP 400). When omitted it is derived from the trade's
  entry timeframe, falling back to DEFAULT_RESOLUTION when that is unset or not
  mappable.

  Issue #236 lifted the old RESOLUTIONS-only gate now that `aggregate_candles`
  (candle_service) understands arbitrary `{value}{unit}` durations.
  """
  if resolution is not None:
    token = resolution.strip()
    legacy = token.upper()
    if legacy in RESOLUTIONS:
      return legacy
    # candle_service.timeframe_to_ms raises ValueError for anything that is
    # neither a legacy token nor a valid `{value}{unit}` TradingView token.
    try:
      candle_service.timeframe_to_ms(token)
    except ValueError as exc:
      raise ValidationError(
        f"Invalid resolution '{resolution}'. Expected a legacy token "
        f"({', '.join(RESOLUTIONS)}) or a '{{value}}{{unit}}' token like "
        "'15m', '4h', '1D'."
      ) from exc
    return token

  value = trade.get("timeframe_value")
  unit = trade.get("timeframe_unit")
  if value is not None and unit is not None:
    token = f"{value}{unit}".lower()
    return _TF_TOKEN_TO_RESOLUTION.get(token, DEFAULT_RESOLUTION)
  return DEFAULT_RESOLUTION


def validate_chart_timeframes(tfs: Any) -> None:
  """Raise ValidationError when a chart-timeframes list is malformed.

  Each entry must be a {"unit", "value"} object with a valid TradingView unit
  ('m', 'h', 'D', 'W') and a positive integer value; duplicate (unit, value)
  pairs are rejected. Mirrors the preferences validation (issue #235).
  """
  if not isinstance(tfs, list):
    raise ValidationError("chart_timeframes must be a list")
  seen: set[tuple[str, int]] = set()
  for item in tfs:
    if not isinstance(item, dict):
      raise ValidationError(
        "Each chart_timeframes item must be an object with 'unit' and 'value'"
      )
    unit = item.get("unit")
    value = item.get("value")
    if unit not in VALID_TIMEFRAME_UNITS:
      raise ValidationError(
        f"Invalid timeframe unit '{unit}'. Valid units: m, h, D, W"
      )
    # bool is a subclass of int in Python; reject it explicitly.
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
      raise ValidationError(
        f"Timeframe value must be a positive integer, got {value!r}"
      )
    pair = (unit, value)
    if pair in seen:
      raise ValidationError(f"Duplicate timeframe {unit}{value} in chart_timeframes")
    seen.add(pair)


def resolve_chart_timeframes(
  trade: dict[str, Any], user_preferences: dict[str, Any]
) -> list[dict[str, Any]]:
  """Compute the effective chart-timeframe list for a trade (issue #236).

  Resolution order:
    1. source = trade['chart_timeframes'] when not None, else
       user_preferences['chart_timeframes_default'], else [].
    2. The trade's entry timeframe (timeframe_unit/value) is injected so it is
       always present.
    3. Entries are de-duplicated by (unit, value), keeping the first occurrence.
    4. The entry timeframe is flagged with is_entry=True.
    5. The list is sorted ascending by unit weight (m < h < D < W), then value.

  Each returned entry is {"unit", "value", "resolution", "is_entry"} where
  `resolution` is the `{value}{unit}` token the candles endpoint expects.
  """
  raw = trade.get("chart_timeframes")
  source = raw if raw is not None else (user_preferences.get("chart_timeframes_default") or [])

  entry_unit = trade.get("timeframe_unit")
  entry_value = trade.get("timeframe_value")
  has_entry = (
    entry_unit in VALID_TIMEFRAME_UNITS
    and isinstance(entry_value, int)
    and not isinstance(entry_value, bool)
    and entry_value > 0
  )
  entry_pair = (entry_unit, entry_value) if has_entry else None

  # Inject the entry timeframe first so it survives the keep-first dedup.
  candidates: list[dict[str, Any]] = []
  if entry_pair is not None:
    candidates.append({"unit": entry_unit, "value": entry_value})
  candidates.extend(source)

  seen: set[tuple[Any, Any]] = set()
  resolved: list[dict[str, Any]] = []
  for item in candidates:
    unit = item.get("unit")
    value = item.get("value")
    pair = (unit, value)
    if pair in seen:
      continue
    seen.add(pair)
    resolved.append(
      {
        "unit": unit,
        "value": value,
        "resolution": f"{value}{unit}",
        "is_entry": pair == entry_pair,
      }
    )

  resolved.sort(key=lambda tf: (UNIT_WEIGHTS.get(tf["unit"], 99), tf["value"]))
  return resolved


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


def _to_storage_candles(
  raw: list[dict[str, Any]], symbol: Optional[str] = None
) -> list[dict[str, Any]]:
  """Convert Massive candles ({o,h,l,c,v,t}) to storage shape.

  *symbol* tags every candle with its contract ticker (Futures); it is None for
  forex/stocks, which store a single un-symboled series.
  """
  return [
    {
      "timestamp": int(c["t"]),
      "symbol": symbol,
      "open": float(c["o"]),
      "high": float(c["h"]),
      "low": float(c["l"]),
      "close": float(c["c"]),
      "volume": float(c["v"]),
    }
    for c in raw
  ]


def _last_activity_date(
  activities: list[dict[str, Any]], fallback: datetime
) -> datetime:
  """Return the latest activity datetime, used as the trade's exit anchor.

  Falls back to *fallback* (the entry anchor) when no activity carries a date.
  """
  dates = [_parse_date(a["date"]) for a in activities if a.get("date")]
  return max(dates) if dates else fallback


def _chart_candle(row: dict[str, Any]) -> dict[str, Any]:
  """Strip a stored row to the canonical OHLCV chart shape (drops symbol)."""
  return {
    "timestamp": row["timestamp"],
    "open": row["open"],
    "high": row["high"],
    "low": row["low"],
    "close": row["close"],
    "volume": row["volume"],
  }


def _window_bounds(
  start_anchor: datetime, end_anchor: datetime
) -> tuple[str, str, int, int]:
  """Return (start_str, end_str, start_ts, end_ts) for the padded date window.

  The window is [start_anchor - WINDOW_DAYS, end_anchor + WINDOW_DAYS]; the upper
  bound is the full end day (inclusive) in Unix milliseconds.
  """
  start_date = (start_anchor - timedelta(days=WINDOW_DAYS)).date()
  end_date = (end_anchor + timedelta(days=WINDOW_DAYS)).date()
  start_ts = _to_ms(
    datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
  )
  end_ts = (
    _to_ms(datetime(end_date.year, end_date.month, end_date.day, tzinfo=timezone.utc))
    + _MS_PER_DAY
    - 1
  )
  return start_date.isoformat(), end_date.isoformat(), start_ts, end_ts


def _symbol_at(rows: list[dict[str, Any]], anchor: datetime) -> Optional[str]:
  """Return the `symbol` of the stored row whose timestamp is nearest *anchor*.

  Used to recover the entry contract ticker from already-stored Futures candles
  without calling Massive. Returns None when *rows* is empty.
  """
  if not rows:
    return None
  target = _to_ms(anchor)
  nearest = min(rows, key=lambda row: abs(row["timestamp"] - target))
  return nearest.get("symbol")


def _add_segment(
  segments: dict[Optional[str], dict[str, Any]],
  symbol: Optional[str],
  fetch_ticker: str,
  when: datetime,
) -> None:
  """Register (or widen) a fetch segment keyed by its stored *symbol*.

  Each segment records the contract ticker to fetch and the [start, end] anchor
  range it must cover; repeated calls for the same symbol widen that range.
  """
  segment = segments.get(symbol)
  if segment is None:
    segments[symbol] = {"fetch_ticker": fetch_ticker, "start": when, "end": when}
  else:
    segment["start"] = min(segment["start"], when)
    segment["end"] = max(segment["end"], when)


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

  activities = await trade_repository.get_activities(trade_id)

  # Anchor the window on the trade (entry) date.
  trade_date = trade.get("trade_date")
  entry_anchor = _parse_date(trade_date) if trade_date else datetime.now(timezone.utc)

  # Build the set of series to fetch/store. `storage_ticker` is the parquet
  # filename stem; `response_ticker` is what the chart reports. Each segment is
  # keyed by the symbol stored in the file (the contract ticker for Futures,
  # None for forex/stocks).
  segments: dict[Optional[str], dict[str, Any]] = {}
  if asset.get("category") == AssetCategory.futures.value:
    # Futures assets store a base product code (e.g. "NQ"). Contract resolution
    # calls Massive every time and is not cached, so check parquet first: when
    # candles already cover the trade window, the contract ticker is recovered
    # from the stored `symbol` column and Massive is never touched.
    base_ticker = ticker
    storage_ticker = base_ticker
    exit_anchor = _last_activity_date(activities, entry_anchor)
    overall_start, overall_end = entry_anchor, exit_anchor

    _, _, win_start_ts, win_end_ts = _window_bounds(entry_anchor, exit_anchor)
    stored = candle_service.read_candles(storage_ticker, win_start_ts, win_end_ts)
    if stored:
      # The entry contract is the symbol of the candle nearest the entry anchor.
      response_ticker = _symbol_at(stored, entry_anchor) or base_ticker
    else:
      # No stored candles — resolve the active contract at the entry date. A
      # failure here is fatal: there is nothing to chart.
      try:
        entry_contract = await futures_service.resolve_contract(
          base_ticker, entry_anchor.date()
        )
      except FuturesResolutionError as exc:
        logger.info("Futures contract resolution failed: %s", exc)
        return {"data": None, "meta": {"reason": "contract_unresolved"}}

      response_ticker = entry_contract
      _add_segment(segments, entry_contract, entry_contract, entry_anchor)

      # A trade can span a contract roll: resolve the contract active at the
      # exit date too and accumulate both into the single base-product file.
      # Skip the call when entry and exit fall on the same date (day trades) —
      # the contract is identical. Failure here is non-fatal: the entry
      # contract still charts on its own.
      if exit_anchor.date() != entry_anchor.date():
        try:
          exit_contract = await futures_service.resolve_contract(
            base_ticker, exit_anchor.date()
          )
          _add_segment(segments, exit_contract, exit_contract, exit_anchor)
        except FuturesResolutionError as exc:
          logger.info("Futures exit contract resolution failed: %s", exc)
  else:
    storage_ticker = ticker
    response_ticker = ticker
    overall_start = overall_end = entry_anchor
    _add_segment(segments, None, ticker, entry_anchor)

  # Lazily fetch each segment from Massive when its stored range is empty.
  for symbol, segment in segments.items():
    seg_start_str, seg_end_str, seg_start_ts, seg_end_ts = _window_bounds(
      segment["start"], segment["end"]
    )
    stored = candle_service.read_candles(
      storage_ticker, seg_start_ts, seg_end_ts, symbol=symbol
    )
    if not stored:
      raw = await massive_service.fetch_candles(
        segment["fetch_ticker"], seg_start_str, seg_end_str
      )
      if raw:
        candle_service.store_candles(
          storage_ticker, _to_storage_candles(raw, symbol=symbol)
        )

  # Read the merged window spanning the trade (entry through exit).
  start_str, end_str, start_ts, end_ts = _window_bounds(overall_start, overall_end)

  rows = candle_service.read_candles(storage_ticker, start_ts, end_ts)
  candles = [_chart_candle(row) for row in rows]

  # "M1" (legacy) and "1m" (TradingView) are the stored base timeframe — no
  # aggregation needed; any other token is aggregated up from M1.
  if timeframe not in ("M1", "1m"):
    candles = candle_service.aggregate_candles(candles, timeframe)

  markers = _build_markers(activities)

  data = {
    "ticker": response_ticker,
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
