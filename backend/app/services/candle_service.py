"""Candle storage service — persists M1 OHLCV candles as parquet files (issue #193).

One parquet file per ticker under CANDLES_DIR.  All functions are synchronous;
no database connection is involved.
"""
import logging
import re
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from app.database import DB_PATH

logger = logging.getLogger(__name__)

# Anchored to the database directory (honours the KIROKU_DB_PATH override),
# mirroring SCREENSHOTS_DIR so candle files share the app's data location.
CANDLES_DIR = DB_PATH.parent / "candles"

# Parquet schema for all candle files.
#
# `symbol` carries the contract ticker for Futures (e.g. NQH26), so a single
# base-product file (NQ.parquet) can hold candles for multiple contracts. It is
# nullable: forex/stocks files store None. Legacy files written before this
# column existed are read without forcing the schema (see read_candles), and
# their rows are treated as symbol=None.
_SCHEMA = pa.schema(
  [
    ("timestamp", pa.int64()),
    ("symbol", pa.string()),
    ("open", pa.float64()),
    ("high", pa.float64()),
    ("low", pa.float64()),
    ("close", pa.float64()),
    ("volume", pa.float64()),
  ]
)

# Millisecond durations for the legacy timeframe tokens (issue #189).
_LEGACY_TIMEFRAME_MS: dict[str, int] = {
  "M1": 60 * 1000,
  "M5": 5 * 60 * 1000,
  "M15": 15 * 60 * 1000,
  "H1": 60 * 60 * 1000,
  "H4": 4 * 60 * 60 * 1000,
  "D1": 24 * 60 * 60 * 1000,
}

# Millisecond duration of one unit, TradingView casing convention (issue #236):
# 'm' minutes, 'h' hours, 'D' days, 'W' weeks.
_UNIT_MS: dict[str, int] = {
  "m": 60 * 1000,
  "h": 60 * 60 * 1000,
  "D": 24 * 60 * 60 * 1000,
  "W": 7 * 24 * 60 * 60 * 1000,
}

# A free-form TradingView resolution token: a positive integer followed by a
# valid unit, e.g. '3m', '12h', '2D', '1W'.
_TF_TOKEN_RE = re.compile(r"^(\d+)([mhDW])$")


def timeframe_to_ms(timeframe: str) -> int:
  """Return the millisecond duration of a resolution token.

  Accepts both legacy tokens (M1, M5, M15, H1, H4, D1) and arbitrary
  TradingView-casing tokens ('{value}{unit}', e.g. '3m', '12h', '2D', '1W').

  Raises:
    ValueError: when *timeframe* matches neither form, or its value is not a
      positive integer.
  """
  if timeframe in _LEGACY_TIMEFRAME_MS:
    return _LEGACY_TIMEFRAME_MS[timeframe]
  match = _TF_TOKEN_RE.match(timeframe)
  if match is None:
    raise ValueError(
      f"Unknown timeframe '{timeframe}'. Expected a legacy token "
      f"({', '.join(_LEGACY_TIMEFRAME_MS)}) or a '{{value}}{{unit}}' token "
      "like '3m', '12h', '2D', '1W'."
    )
  value = int(match.group(1))
  if value <= 0:
    raise ValueError(f"Timeframe value must be positive, got {value}")
  return value * _UNIT_MS[match.group(2)]


# Characters forbidden in Windows filenames.
_FORBIDDEN_RE = re.compile(r'[<>:"/\\|?*]')


def _sanitize_ticker(ticker: str) -> str:
  """Replace Windows-forbidden filename characters in *ticker* with underscores."""
  return _FORBIDDEN_RE.sub("_", ticker)


def _candle_path(ticker: str) -> Path:
  """Return the parquet file path for *ticker* (sanitized for all platforms)."""
  return Path(CANDLES_DIR) / f"{_sanitize_ticker(ticker)}.parquet"


def migrate_candle_filenames() -> None:
  """Rename existing candle files whose names contain forbidden characters.

  Scans CANDLES_DIR for *.parquet files and renames any whose stem contains a
  Windows-forbidden character to the sanitized equivalent.  Safe to call on
  every startup: idempotent, skips already-clean files, and never overwrites an
  existing sanitized target (logs a warning and skips instead).
  """
  candles_dir = Path(CANDLES_DIR)
  if not candles_dir.exists():
    return

  for parquet_file in candles_dir.glob("*.parquet"):
    stem = parquet_file.stem
    sanitized_stem = _sanitize_ticker(stem)
    if sanitized_stem == stem:
      continue  # Already clean — nothing to do.

    target = parquet_file.parent / f"{sanitized_stem}.parquet"
    if target.exists():
      logger.warning(
        "migrate_candle_filenames: skipping %s → %s (target already exists)",
        parquet_file.name,
        target.name,
      )
      continue

    parquet_file.rename(target)
    logger.info(
      "migrate_candle_filenames: renamed %s → %s",
      parquet_file.name,
      target.name,
    )


def store_candles(ticker: str, candles: list[dict]) -> int:
  """Append candles to the ticker's parquet file with upsert semantics.

  Rows are keyed by ``(symbol, timestamp)`` so multiple Futures contracts can
  coexist in one base-product file: a candle whose ``(symbol, timestamp)``
  already exists replaces the stored row, while only previously-unseen pairs are
  counted as *new*. Candles without a ``symbol`` key are stored as symbol=None
  (the forex/stocks case), preserving the original timestamp-only semantics.

  Args:
    ticker:  Ticker symbol, used as the filename stem.
    candles: List of dicts with keys: timestamp, open, high, low, close, volume,
             and an optional symbol (contract ticker for Futures).

  Returns:
    The number of *new* rows written (replacements are not counted).
    Returns 0 immediately when *candles* is empty.
  """
  if not candles:
    return 0

  path = _candle_path(ticker)

  # Read existing data into a dict keyed by (symbol, timestamp) so duplicates
  # from the existing file are deduplicated along with incoming ones. The schema
  # is not forced on read: legacy files lack the `symbol` column, and their rows
  # are normalized to symbol=None below.
  existing: dict[tuple[str | None, int], dict] = {}
  if path.exists():
    table = pq.read_table(path)
    for row in table.to_pylist():
      symbol = row.get("symbol")
      existing[(symbol, row["timestamp"])] = {
        "timestamp": row["timestamp"],
        "symbol": symbol,
        "open": row["open"],
        "high": row["high"],
        "low": row["low"],
        "close": row["close"],
        "volume": row["volume"],
      }

  existing_keys = set(existing.keys())

  # Apply incoming candles: upsert into the existing dict.
  for candle in candles:
    ts = int(candle["timestamp"])
    symbol = candle.get("symbol")
    existing[(symbol, ts)] = {
      "timestamp": ts,
      "symbol": symbol,
      "open": float(candle["open"]),
      "high": float(candle["high"]),
      "low": float(candle["low"]),
      "close": float(candle["close"]),
      "volume": float(candle["volume"]),
    }

  # Count only (symbol, timestamp) pairs that were NOT present before this call.
  incoming_keys = {(c.get("symbol"), int(c["timestamp"])) for c in candles}
  new_count = len(incoming_keys - existing_keys)

  # Sort merged rows ascending by timestamp, then symbol for a stable order.
  merged = sorted(existing.values(), key=lambda r: (r["timestamp"], r["symbol"] or ""))

  path.parent.mkdir(parents=True, exist_ok=True)
  table = pa.Table.from_pylist(merged, schema=_SCHEMA)
  # Write to a temp file then rename: rename is atomic on POSIX, so a crash
  # mid-write cannot truncate the existing historical data for this ticker.
  tmp = path.with_suffix(".tmp")
  pq.write_table(table, tmp)
  tmp.rename(path)

  logger.debug("store_candles(%s): %d new rows written", ticker, new_count)
  return new_count


def read_candles(
  ticker: str, start_ts: int, end_ts: int, symbol: str | None = None
) -> list[dict]:
  """Return candles whose timestamp falls within [start_ts, end_ts] (inclusive).

  Args:
    ticker:   Ticker symbol (filename stem; the base product code for Futures).
    start_ts: Lower bound timestamp in Unix milliseconds.
    end_ts:   Upper bound timestamp in Unix milliseconds.
    symbol:   When given, keep only rows whose contract ticker matches; when
              None, return rows for all contracts (no symbol filtering).

  Returns:
    List of candle dicts (keys: timestamp, symbol, open, high, low, close,
    volume), sorted ascending. Returns [] if the parquet file does not exist.
    Legacy files without a `symbol` column report symbol=None.
  """
  path = _candle_path(ticker)
  if not path.exists():
    return []

  # No schema is forced: legacy files predate the `symbol` column and would
  # otherwise fail to read. Missing symbols are normalized to None.
  table = pq.read_table(path)
  result: list[dict] = []
  for row in table.to_pylist():
    row_symbol = row.get("symbol")
    if symbol is not None and row_symbol != symbol:
      continue
    if start_ts <= row["timestamp"] <= end_ts:
      row["symbol"] = row_symbol
      result.append(row)
  return result


def aggregate_candles(candles: list[dict], timeframe: str) -> list[dict]:
  """Aggregate M1 candles into a higher timeframe.  Pure function — no I/O.

  Bucket boundaries are aligned to the Unix epoch:
    bucket_start = floor(timestamp_ms / bucket_ms) * bucket_ms

  For each bucket the result candle is:
    timestamp = bucket start (Unix ms)
    open      = first candle's open
    high      = max of all highs
    low       = min of all lows
    close     = last candle's close
    volume    = sum of all volumes

  Args:
    candles:   List of M1 candle dicts, assumed sorted ascending (sorted
               defensively inside this function).
    timeframe: A legacy token (M5, M15, H1, H4, D1) or a TradingView-casing
               token ('{value}{unit}', e.g. '3m', '12h', '2D', '1W').

  Returns:
    List of aggregated candle dicts sorted ascending.  Returns [] for empty input.

  Raises:
    ValueError: When *timeframe* is not a recognised token (see timeframe_to_ms).
  """
  bucket_ms = timeframe_to_ms(timeframe)

  if not candles:
    return []
  sorted_candles = sorted(candles, key=lambda c: c["timestamp"])

  buckets: dict[int, list[dict]] = {}
  for candle in sorted_candles:
    ts = int(candle["timestamp"])
    bucket_start = (ts // bucket_ms) * bucket_ms
    buckets.setdefault(bucket_start, []).append(candle)

  result: list[dict] = []
  for bucket_start in sorted(buckets):
    group = buckets[bucket_start]
    result.append(
      {
        "timestamp": bucket_start,
        "open": float(group[0]["open"]),
        "high": float(max(c["high"] for c in group)),
        "low": float(min(c["low"] for c in group)),
        "close": float(group[-1]["close"]),
        "volume": float(sum(c["volume"] for c in group)),
      }
    )

  return result
