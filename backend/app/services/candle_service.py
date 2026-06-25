"""Candle storage service — persists M1 OHLCV candles as parquet files (issue #193).

One parquet file per ticker under CANDLES_DIR.  All functions are synchronous;
no database connection is involved.
"""
import logging
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from app.database import DB_PATH

logger = logging.getLogger(__name__)

# Anchored to the database directory (honours the KIROKU_DB_PATH override),
# mirroring SCREENSHOTS_DIR so candle files share the app's data location.
CANDLES_DIR = DB_PATH.parent / "candles"

# Parquet schema for all candle files.
_SCHEMA = pa.schema(
  [
    ("timestamp", pa.int64()),
    ("open", pa.float64()),
    ("high", pa.float64()),
    ("low", pa.float64()),
    ("close", pa.float64()),
    ("volume", pa.float64()),
  ]
)

# Millisecond durations for each supported timeframe.
_TIMEFRAME_MS: dict[str, int] = {
  "M5": 5 * 60 * 1000,
  "M15": 15 * 60 * 1000,
  "H1": 60 * 60 * 1000,
  "H4": 4 * 60 * 60 * 1000,
  "D1": 24 * 60 * 60 * 1000,
}


def _candle_path(ticker: str) -> Path:
  """Return the parquet file path for *ticker*."""
  return Path(CANDLES_DIR) / f"{ticker}.parquet"


def store_candles(ticker: str, candles: list[dict]) -> int:
  """Append candles to the ticker's parquet file with upsert semantics.

  Incoming candles whose timestamp already exists in the file replace the
  existing row (the stored values are overwritten).  Only rows whose timestamp
  was not previously present are counted as *new*.

  Args:
    ticker:  Ticker symbol, used as the filename stem.
    candles: List of dicts with keys: timestamp, open, high, low, close, volume.

  Returns:
    The number of *new* rows written (replacements are not counted).
    Returns 0 immediately when *candles* is empty.
  """
  if not candles:
    return 0

  path = _candle_path(ticker)

  # Read existing data into a dict keyed by timestamp so duplicates from the
  # existing file are deduplicated along with incoming ones.
  existing: dict[int, dict] = {}
  if path.exists():
    table = pq.read_table(path, schema=_SCHEMA)
    for row in table.to_pylist():
      existing[row["timestamp"]] = row

  existing_timestamps = set(existing.keys())

  # Apply incoming candles: upsert into the existing dict.
  for candle in candles:
    ts = int(candle["timestamp"])
    existing[ts] = {
      "timestamp": ts,
      "open": float(candle["open"]),
      "high": float(candle["high"]),
      "low": float(candle["low"]),
      "close": float(candle["close"]),
      "volume": float(candle["volume"]),
    }

  # Count only timestamps that were NOT present before this call.
  incoming_timestamps = {int(c["timestamp"]) for c in candles}
  new_count = len(incoming_timestamps - existing_timestamps)

  # Sort merged rows ascending by timestamp and write back.
  merged = sorted(existing.values(), key=lambda r: r["timestamp"])

  path.parent.mkdir(parents=True, exist_ok=True)
  table = pa.Table.from_pylist(merged, schema=_SCHEMA)
  # Write to a temp file then rename: rename is atomic on POSIX, so a crash
  # mid-write cannot truncate the existing historical data for this ticker.
  tmp = path.with_suffix(".tmp")
  pq.write_table(table, tmp)
  tmp.rename(path)

  logger.debug("store_candles(%s): %d new rows written", ticker, new_count)
  return new_count


def read_candles(ticker: str, start_ts: int, end_ts: int) -> list[dict]:
  """Return candles whose timestamp falls within [start_ts, end_ts] (inclusive).

  Args:
    ticker:   Ticker symbol.
    start_ts: Lower bound timestamp in Unix milliseconds.
    end_ts:   Upper bound timestamp in Unix milliseconds.

  Returns:
    List of candle dicts (keys: timestamp, open, high, low, close, volume),
    sorted ascending.  Returns [] if the parquet file does not exist.
  """
  path = _candle_path(ticker)
  if not path.exists():
    return []

  table = pq.read_table(path, schema=_SCHEMA)
  rows = table.to_pylist()
  return [r for r in rows if start_ts <= r["timestamp"] <= end_ts]


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
    timeframe: One of M5, M15, H1, H4, D1.

  Returns:
    List of aggregated candle dicts sorted ascending.  Returns [] for empty input.

  Raises:
    ValueError: When *timeframe* is not one of the supported values.
  """
  if timeframe not in _TIMEFRAME_MS:
    raise ValueError(
      f"Unknown timeframe '{timeframe}'. Supported: {', '.join(_TIMEFRAME_MS)}"
    )

  if not candles:
    return []

  bucket_ms = _TIMEFRAME_MS[timeframe]
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
