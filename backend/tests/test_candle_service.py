"""Tests for app.services.candle_service (issue #193)."""
from pathlib import Path

import pytest

from app.services import candle_service

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def isolated_candles_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
  """Redirect CANDLES_DIR to a temporary directory for every test.

  This prevents the real backend/data/candles/ directory from being touched.
  """
  monkeypatch.setattr(candle_service, "CANDLES_DIR", str(tmp_path / "candles"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_candle(ts: int, o: float = 1.0, h: float = 2.0, lo: float = 0.5, c: float = 1.5, v: float = 100.0) -> dict:
  return {"timestamp": ts, "open": o, "high": h, "low": lo, "close": c, "volume": v}


# ---------------------------------------------------------------------------
# store_candles
# ---------------------------------------------------------------------------


def test_store_candles_creates_file() -> None:
  """Writing candles to a new ticker creates the parquet file."""
  candles = [_make_candle(1000), _make_candle(2000)]
  new_count = candle_service.store_candles("C:EURUSD", candles)

  assert new_count == 2
  path = candle_service._candle_path("C:EURUSD")
  assert path.exists()


def test_store_candles_empty_input_returns_zero_no_file() -> None:
  """Empty candle list returns 0 and does not create a file."""
  new_count = candle_service.store_candles("C:EURUSD", [])

  assert new_count == 0
  path = candle_service._candle_path("C:EURUSD")
  assert not path.exists()


def test_store_candles_deduplicates_within_batch() -> None:
  """Duplicate timestamps within the same call are stored only once."""
  candles = [_make_candle(1000, o=1.0), _make_candle(1000, o=2.0)]
  new_count = candle_service.store_candles("TICK", candles)

  # Only one unique timestamp → 1 new row.
  assert new_count == 1
  stored = candle_service.read_candles("TICK", 0, 9999)
  assert len(stored) == 1
  # Last candle in the batch wins.
  assert stored[0]["open"] == 2.0


def test_store_candles_upsert_replaces_existing_row() -> None:
  """A candle whose timestamp already exists overwrites the old values."""
  candle_service.store_candles("TICK", [_make_candle(1000, o=1.0, c=1.5)])
  new_count = candle_service.store_candles("TICK", [_make_candle(1000, o=9.9, c=8.8)])

  # Timestamp already existed → 0 new rows.
  assert new_count == 0
  stored = candle_service.read_candles("TICK", 0, 9999)
  assert len(stored) == 1
  assert stored[0]["open"] == 9.9
  assert stored[0]["close"] == 8.8


def test_store_candles_counts_only_new_timestamps() -> None:
  """When a batch mixes new and existing timestamps, only new ones are counted."""
  candle_service.store_candles("TICK", [_make_candle(1000), _make_candle(2000)])
  # 1000 already exists; 3000 is new.
  new_count = candle_service.store_candles("TICK", [_make_candle(1000), _make_candle(3000)])

  assert new_count == 1


def test_store_candles_sorted_ascending() -> None:
  """Stored candles are always sorted ascending by timestamp."""
  candles = [_make_candle(3000), _make_candle(1000), _make_candle(2000)]
  candle_service.store_candles("TICK", candles)

  stored = candle_service.read_candles("TICK", 0, 9999)
  timestamps = [r["timestamp"] for r in stored]
  assert timestamps == sorted(timestamps)


def test_store_candles_appends_across_calls() -> None:
  """Multiple store calls accumulate rows in the same file."""
  candle_service.store_candles("TICK", [_make_candle(1000)])
  candle_service.store_candles("TICK", [_make_candle(2000)])
  candle_service.store_candles("TICK", [_make_candle(3000)])

  stored = candle_service.read_candles("TICK", 0, 9999)
  assert len(stored) == 3


def test_store_candles_creates_nested_dir() -> None:
  """The candles directory is created on first write even when it doesn't exist."""
  path = candle_service._candle_path("TICK")
  assert not path.parent.exists()

  candle_service.store_candles("TICK", [_make_candle(1000)])

  assert path.parent.exists()
  assert path.exists()


# ---------------------------------------------------------------------------
# read_candles
# ---------------------------------------------------------------------------


def test_read_candles_missing_file_returns_empty() -> None:
  """read_candles returns [] when the ticker file does not exist."""
  result = candle_service.read_candles("NONEXISTENT", 0, 999999)
  assert result == []


def test_read_candles_inclusive_bounds() -> None:
  """start_ts and end_ts are both inclusive."""
  candle_service.store_candles("TICK", [_make_candle(1000), _make_candle(2000), _make_candle(3000)])

  result = candle_service.read_candles("TICK", 1000, 2000)

  timestamps = [r["timestamp"] for r in result]
  assert timestamps == [1000, 2000]


def test_read_candles_no_match_returns_empty() -> None:
  """read_candles returns [] when no candle falls within the range."""
  candle_service.store_candles("TICK", [_make_candle(5000)])
  result = candle_service.read_candles("TICK", 1000, 3000)
  assert result == []


def test_read_candles_returns_correct_fields() -> None:
  """Returned dicts contain all expected candle keys with correct values."""
  candle_service.store_candles("TICK", [_make_candle(1000, o=1.1, h=2.2, lo=0.3, c=1.8, v=500.0)])
  result = candle_service.read_candles("TICK", 1000, 1000)

  assert len(result) == 1
  row = result[0]
  assert row["timestamp"] == 1000
  assert row["open"] == 1.1
  assert row["high"] == 2.2
  assert row["low"] == 0.3
  assert row["close"] == 1.8
  assert row["volume"] == 500.0


# ---------------------------------------------------------------------------
# aggregate_candles
# ---------------------------------------------------------------------------

# Unix epoch offsets used across aggregation tests (values in ms).
_M1 = 60_000          # one minute
_M5 = 5 * _M1        # five minutes
_M15 = 15 * _M1
_H1 = 60 * _M1
_H4 = 4 * _H1
_D1 = 24 * _H1


def test_aggregate_empty_returns_empty() -> None:
  """aggregate_candles returns [] for empty input."""
  assert candle_service.aggregate_candles([], "M5") == []


def test_aggregate_unknown_timeframe_raises() -> None:
  """aggregate_candles raises ValueError for unsupported timeframes."""
  with pytest.raises(ValueError, match="Unknown timeframe"):
    candle_service.aggregate_candles([_make_candle(0)], "W1")


def test_aggregate_m5_single_bucket() -> None:
  """Five M1 candles within one M5 bucket aggregate correctly."""
  candles = [
    _make_candle(0 * _M1, o=1.0, h=1.5, lo=0.8, c=1.2, v=10.0),
    _make_candle(1 * _M1, o=1.2, h=1.6, lo=0.9, c=1.3, v=20.0),
    _make_candle(2 * _M1, o=1.3, h=1.7, lo=0.7, c=1.1, v=15.0),
    _make_candle(3 * _M1, o=1.1, h=1.4, lo=0.6, c=1.4, v=25.0),
    _make_candle(4 * _M1, o=1.4, h=1.8, lo=0.5, c=1.5, v=30.0),
  ]
  result = candle_service.aggregate_candles(candles, "M5")

  assert len(result) == 1
  agg = result[0]
  assert agg["timestamp"] == 0
  assert agg["open"] == 1.0     # first open
  assert agg["high"] == 1.8     # max high
  assert agg["low"] == 0.5      # min low
  assert agg["close"] == 1.5    # last close
  assert agg["volume"] == 100.0  # sum


def test_aggregate_m5_multiple_buckets() -> None:
  """Candles spanning two M5 buckets produce two result rows."""
  candles = [
    _make_candle(0 * _M1, v=10.0),           # bucket 0
    _make_candle(4 * _M1, v=10.0),           # bucket 0
    _make_candle(5 * _M1, v=20.0),           # bucket 1
    _make_candle(9 * _M1, v=20.0),           # bucket 1
  ]
  result = candle_service.aggregate_candles(candles, "M5")

  assert len(result) == 2
  assert result[0]["timestamp"] == 0
  assert result[0]["volume"] == 20.0
  assert result[1]["timestamp"] == _M5
  assert result[1]["volume"] == 40.0


def test_aggregate_m15() -> None:
  """M15 bucket contains exactly 15 M1 candles."""
  candles = [_make_candle(i * _M1, v=1.0) for i in range(15)]
  result = candle_service.aggregate_candles(candles, "M15")

  assert len(result) == 1
  assert result[0]["timestamp"] == 0
  assert result[0]["volume"] == 15.0


def test_aggregate_h1() -> None:
  """H1 bucket groups 60 minutes."""
  candles = [_make_candle(i * _M1, v=1.0) for i in range(60)]
  result = candle_service.aggregate_candles(candles, "H1")

  assert len(result) == 1
  assert result[0]["timestamp"] == 0
  assert result[0]["volume"] == 60.0


def test_aggregate_h4() -> None:
  """H4 bucket groups 240 minutes across two H1 periods."""
  candles = [_make_candle(i * _H1, v=1.0) for i in range(4)]
  result = candle_service.aggregate_candles(candles, "H4")

  assert len(result) == 1
  assert result[0]["timestamp"] == 0
  assert result[0]["volume"] == 4.0


def test_aggregate_d1() -> None:
  """D1 bucket groups 24 H1 candles into one day."""
  candles = [_make_candle(i * _H1, v=1.0) for i in range(24)]
  result = candle_service.aggregate_candles(candles, "D1")

  assert len(result) == 1
  assert result[0]["timestamp"] == 0
  assert result[0]["volume"] == 24.0


def test_aggregate_sorts_unsorted_input() -> None:
  """aggregate_candles handles unsorted input correctly."""
  candles = [
    _make_candle(4 * _M1, o=5.0, c=5.0, v=5.0),
    _make_candle(0 * _M1, o=1.0, c=1.0, v=1.0),
    _make_candle(2 * _M1, o=3.0, c=3.0, v=3.0),
  ]
  result = candle_service.aggregate_candles(candles, "M5")

  # All in same M5 bucket; open should be from timestamp=0 (first after sort).
  assert len(result) == 1
  assert result[0]["open"] == 1.0
  assert result[0]["close"] == 5.0


def test_aggregate_result_sorted_ascending() -> None:
  """Aggregated result is always sorted ascending."""
  candles = [_make_candle(i * _M5) for i in range(5, -1, -1)]
  result = candle_service.aggregate_candles(candles, "M5")

  timestamps = [r["timestamp"] for r in result]
  assert timestamps == sorted(timestamps)


def test_aggregate_all_supported_timeframes_accepted() -> None:
  """All documented timeframes are accepted without error."""
  candle = _make_candle(0)
  for tf in ("M5", "M15", "H1", "H4", "D1"):
    result = candle_service.aggregate_candles([candle], tf)
    assert len(result) == 1
