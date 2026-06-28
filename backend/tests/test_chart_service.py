"""Tests for app.services.chart_service.resolve_chart_timeframes (issue #236)."""
from app.services.chart_service import resolve_chart_timeframes

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _trade(
  chart_timeframes: list | None = None,
  timeframe_unit: str | None = None,
  timeframe_value: int | None = None,
) -> dict:
  return {
    "chart_timeframes": chart_timeframes,
    "timeframe_unit": timeframe_unit,
    "timeframe_value": timeframe_value,
  }


def _prefs(chart_timeframes_default: list | None = None) -> dict:
  return {"chart_timeframes_default": chart_timeframes_default if chart_timeframes_default is not None else []}


# ---------------------------------------------------------------------------
# Source resolution: trade override vs. user defaults
# ---------------------------------------------------------------------------


def test_fallback_to_user_defaults_when_trade_chart_timeframes_is_none() -> None:
  """When trade chart_timeframes is None, user_preferences defaults are used as source."""
  trade = _trade(chart_timeframes=None)
  prefs = _prefs(chart_timeframes_default=[{"unit": "D", "value": 1}])
  result = resolve_chart_timeframes(trade, prefs)
  assert len(result) == 1
  assert result[0] == {"unit": "D", "value": 1, "resolution": "1D", "is_entry": False}


def test_trade_override_used_when_present_ignores_user_defaults() -> None:
  """When trade chart_timeframes is a list (even non-empty), user defaults are ignored."""
  trade = _trade(chart_timeframes=[{"unit": "m", "value": 5}])
  prefs = _prefs(chart_timeframes_default=[{"unit": "D", "value": 1}])
  result = resolve_chart_timeframes(trade, prefs)
  assert len(result) == 1
  assert result[0]["unit"] == "m"
  assert result[0]["value"] == 5


def test_empty_chart_timeframes_and_no_entry_tf_returns_empty_list() -> None:
  """When trade chart_timeframes=[] and no entry tf, resolved list is empty."""
  trade = _trade(chart_timeframes=[])
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert result == []


def test_null_chart_timeframes_with_empty_user_defaults_and_entry_tf() -> None:
  """When trade chart_timeframes is None and user defaults are empty, only entry tf appears."""
  trade = _trade(chart_timeframes=None, timeframe_unit="m", timeframe_value=15)
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert len(result) == 1
  assert result[0]["unit"] == "m"
  assert result[0]["value"] == 15
  assert result[0]["is_entry"] is True


# ---------------------------------------------------------------------------
# Entry timeframe injection
# ---------------------------------------------------------------------------


def test_entry_tf_injected_before_user_defaults() -> None:
  """Entry tf is included in the resolved list alongside user defaults."""
  trade = _trade(chart_timeframes=None, timeframe_unit="h", timeframe_value=4)
  prefs = _prefs(chart_timeframes_default=[{"unit": "D", "value": 1}])
  result = resolve_chart_timeframes(trade, prefs)
  assert len(result) == 2
  assert result[0] == {"unit": "h", "value": 4, "resolution": "4h", "is_entry": True}
  assert result[1] == {"unit": "D", "value": 1, "resolution": "1D", "is_entry": False}


def test_no_entry_injected_when_trade_has_no_entry_tf() -> None:
  """When trade timeframe_unit/value are None, no entry tf is injected."""
  trade = _trade(chart_timeframes=[{"unit": "m", "value": 5}])
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert len(result) == 1
  assert result[0]["is_entry"] is False


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------


def test_dedup_entry_tf_already_in_chart_timeframes_appears_once_with_is_entry() -> None:
  """When entry tf is in chart_timeframes, it appears once and is_entry=True."""
  trade = _trade(
    chart_timeframes=[{"unit": "h", "value": 1}],
    timeframe_unit="h",
    timeframe_value=1,
  )
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert len(result) == 1
  assert result[0]["is_entry"] is True
  assert result[0]["unit"] == "h"
  assert result[0]["value"] == 1


def test_dedup_entry_tf_in_user_defaults_appears_once_with_is_entry() -> None:
  """When entry tf is in user defaults, it appears once and is_entry=True."""
  trade = _trade(
    chart_timeframes=None,
    timeframe_unit="D",
    timeframe_value=1,
  )
  prefs = _prefs(chart_timeframes_default=[{"unit": "m", "value": 15}, {"unit": "D", "value": 1}])
  result = resolve_chart_timeframes(trade, prefs)
  # D1 should not duplicate; entry wins
  d_items = [r for r in result if r["unit"] == "D" and r["value"] == 1]
  assert len(d_items) == 1
  assert d_items[0]["is_entry"] is True


# ---------------------------------------------------------------------------
# Sorting
# ---------------------------------------------------------------------------


def test_sort_order_ascending_by_unit_weight_then_value() -> None:
  """Resolved list is sorted: minutes < hours < days < weeks, then value ascending."""
  trade = _trade(
    chart_timeframes=[
      {"unit": "D", "value": 1},
      {"unit": "m", "value": 5},
      {"unit": "h", "value": 1},
      {"unit": "m", "value": 15},
    ],
    timeframe_unit="m",
    timeframe_value=5,
  )
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert [(r["unit"], r["value"]) for r in result] == [("m", 5), ("m", 15), ("h", 1), ("D", 1)]


def test_sort_same_unit_ordered_by_value_ascending() -> None:
  """Within the same unit, smaller values come first."""
  trade = _trade(
    chart_timeframes=[{"unit": "m", "value": 60}, {"unit": "m", "value": 1}, {"unit": "m", "value": 15}],
  )
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert [r["value"] for r in result] == [1, 15, 60]


# ---------------------------------------------------------------------------
# Resolution token format
# ---------------------------------------------------------------------------


def test_resolution_token_format_minutes() -> None:
  """Resolution token is '{value}m' for minute entries."""
  trade = _trade(chart_timeframes=[{"unit": "m", "value": 5}])
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert result[0]["resolution"] == "5m"


def test_resolution_token_format_hours() -> None:
  """Resolution token is '{value}h' for hour entries."""
  trade = _trade(chart_timeframes=[{"unit": "h", "value": 4}])
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert result[0]["resolution"] == "4h"


def test_resolution_token_format_days() -> None:
  """Resolution token is '{value}D' for day entries."""
  trade = _trade(chart_timeframes=[{"unit": "D", "value": 1}])
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert result[0]["resolution"] == "1D"


def test_resolution_token_format_weeks() -> None:
  """Resolution token is '{value}W' for week entries."""
  trade = _trade(chart_timeframes=[{"unit": "W", "value": 1}])
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert result[0]["resolution"] == "1W"


# ---------------------------------------------------------------------------
# is_entry flag
# ---------------------------------------------------------------------------


def test_is_entry_true_only_for_the_entry_tf() -> None:
  """Only the entry timeframe has is_entry=True; all others are False."""
  trade = _trade(
    chart_timeframes=[{"unit": "m", "value": 5}, {"unit": "h", "value": 4}],
    timeframe_unit="m",
    timeframe_value=15,
  )
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  # Three entries: m5, m15 (entry), h4
  entry_items = [r for r in result if r["is_entry"]]
  assert len(entry_items) == 1
  assert entry_items[0]["unit"] == "m"
  assert entry_items[0]["value"] == 15


def test_is_entry_false_for_all_when_no_entry_tf() -> None:
  """When the trade has no entry tf, is_entry is False for every resolved item."""
  trade = _trade(
    chart_timeframes=[{"unit": "m", "value": 5}, {"unit": "h", "value": 1}],
    timeframe_unit=None,
    timeframe_value=None,
  )
  prefs = _prefs()
  result = resolve_chart_timeframes(trade, prefs)
  assert all(r["is_entry"] is False for r in result)
