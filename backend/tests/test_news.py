"""Tests for the news event model, repository, and sync service."""
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest

from app.database import database, enable_foreign_keys
from app.models.news_event import NewsEvent
from app.services import news_service
from app.services.news_service import (
  _event_id,
  _map_impact,
  _parse_event,
  _to_utc_iso,
  _week_bounds,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def db() -> Any:
  """Connect the shared async database to the test DB for the duration of a test."""
  enable_foreign_keys()
  await database.connect()
  try:
    yield database
  finally:
    await database.disconnect()


def _raw(
  title: str = "Core CPI m/m",
  country: str = "USD",
  date: str = "2026-06-10T08:30:00-04:00",
  impact: str = "High",
  forecast: str = "0.3%",
  previous: str = "0.4%",
) -> dict[str, Any]:
  return {
    "title": title,
    "country": country,
    "date": date,
    "impact": impact,
    "forecast": forecast,
    "previous": previous,
  }


# ---------------------------------------------------------------------------
# Impact mapping
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
  "raw,expected",
  [
    ("High", "HIGH"),
    ("Medium", "MEDIUM"),
    ("Low", "LOW"),
    ("Holiday", "NONE"),
    ("", "NONE"),
    ("Unknown", "NONE"),
    (None, "NONE"),
  ],
)
def test_map_impact(raw: Any, expected: str) -> None:
  assert _map_impact(raw) == expected


# ---------------------------------------------------------------------------
# Date conversion
# ---------------------------------------------------------------------------


def test_to_utc_iso_converts_offset_to_utc() -> None:
  # 08:30 at -04:00 is 12:30 UTC.
  result = _to_utc_iso("2026-06-10T08:30:00-04:00")
  parsed = datetime.fromisoformat(result)
  assert parsed.tzinfo == timezone.utc
  assert parsed == datetime(2026, 6, 10, 12, 30, tzinfo=timezone.utc)


def test_to_utc_iso_preserves_utc_input() -> None:
  result = _to_utc_iso("2026-06-10T12:30:00+00:00")
  assert datetime.fromisoformat(result) == datetime(2026, 6, 10, 12, 30, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Deterministic id generation
# ---------------------------------------------------------------------------


def test_event_id_is_deterministic_and_16_chars() -> None:
  date_utc = "2026-06-10T12:30:00+00:00"
  first = _event_id("Core CPI m/m", date_utc)
  second = _event_id("Core CPI m/m", date_utc)
  assert first == second
  assert len(first) == 16


def test_event_id_differs_by_title_and_date() -> None:
  date_utc = "2026-06-10T12:30:00+00:00"
  assert _event_id("Core CPI m/m", date_utc) != _event_id("NFP", date_utc)
  assert _event_id("Core CPI m/m", date_utc) != _event_id(
    "Core CPI m/m", "2026-06-11T12:30:00+00:00"
  )


def test_parse_event_maps_all_fields() -> None:
  event = _parse_event(_raw(), synced_at="2026-06-10T00:00:00+00:00")
  assert event.title == "Core CPI m/m"
  assert event.currency == "USD"
  assert event.impact == "HIGH"
  assert event.forecast == "0.3%"
  assert event.previous == "0.4%"
  assert event.date == "2026-06-10T12:30:00+00:00"
  # id is derived from the converted UTC date.
  assert event.id == _event_id("Core CPI m/m", "2026-06-10T12:30:00+00:00")


def test_parse_event_defaults_missing_optional_fields() -> None:
  raw = {"title": "Bank Holiday", "country": "EUR", "date": "2026-06-08T00:00:00+00:00"}
  event = _parse_event(raw, synced_at="2026-06-08T00:00:00+00:00")
  assert event.forecast == ""
  assert event.previous == ""
  assert event.impact == "NONE"


# ---------------------------------------------------------------------------
# Week bounds
# ---------------------------------------------------------------------------


def test_week_bounds_spans_monday_to_sunday() -> None:
  # 2026-06-10 is a Wednesday.
  start, end = _week_bounds(["2026-06-10T12:30:00+00:00"])
  start_dt = datetime.fromisoformat(start)
  end_dt = datetime.fromisoformat(end)
  assert start_dt.weekday() == 0  # Monday
  assert start_dt == datetime(2026, 6, 8, 0, 0, 0, tzinfo=timezone.utc)
  assert end_dt == datetime(2026, 6, 14, 23, 59, 59, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Repository (DB-backed)
# ---------------------------------------------------------------------------


def _event(
  title: str = "Core CPI m/m",
  date: str = "2026-06-10T12:30:00+00:00",
  currency: str = "USD",
  impact: str = "HIGH",
) -> NewsEvent:
  return NewsEvent(
    id=_event_id(title, date),
    date=date,
    title=title,
    currency=currency,
    impact=impact,
    forecast="0.3%",
    previous="0.4%",
    synced_at="2026-06-09T00:00:00+00:00",
  )


async def test_save_and_load_for_period(db: Any) -> None:
  from app.repositories import news_repository

  events = [
    _event(title="Core CPI m/m", date="2026-06-10T12:30:00+00:00"),
    _event(title="NFP", date="2026-06-12T12:30:00+00:00", impact="HIGH"),
  ]
  saved = await news_repository.save_events(events)
  assert saved == 2

  loaded = await news_repository.load_for_period(
    "2026-06-08T00:00:00+00:00", "2026-06-14T23:59:59+00:00"
  )
  assert [e.title for e in loaded] == ["Core CPI m/m", "NFP"]


async def test_save_events_upserts_by_id(db: Any) -> None:
  from app.repositories import news_repository

  event = _event(title="Core CPI m/m", date="2026-06-10T12:30:00+00:00")
  await news_repository.save_events([event])
  # Same id, changed forecast: should replace, not duplicate.
  event.forecast = "9.9%"
  await news_repository.save_events([event])

  loaded = await news_repository.load_for_period(
    "2026-06-08T00:00:00+00:00", "2026-06-14T23:59:59+00:00"
  )
  assert len(loaded) == 1
  assert loaded[0].forecast == "9.9%"


async def test_delete_for_period_returns_count(db: Any) -> None:
  from app.repositories import news_repository

  await news_repository.save_events(
    [
      _event(title="A", date="2026-06-10T12:30:00+00:00"),
      _event(title="B", date="2026-06-20T12:30:00+00:00"),
    ]
  )
  deleted = await news_repository.delete_for_period(
    "2026-06-08T00:00:00+00:00", "2026-06-14T23:59:59+00:00"
  )
  assert deleted == 1
  remaining = await news_repository.load_for_period(
    "2026-06-01T00:00:00+00:00", "2026-06-30T00:00:00+00:00"
  )
  assert [e.title for e in remaining] == ["B"]


async def test_get_last_sync_time(db: Any) -> None:
  from app.repositories import news_repository

  assert await news_repository.get_last_sync_time() is None
  event = _event()
  event.synced_at = "2026-06-09T10:00:00+00:00"
  await news_repository.save_events([event])
  assert await news_repository.get_last_sync_time() == "2026-06-09T10:00:00+00:00"


# ---------------------------------------------------------------------------
# Sync service (mocked HTTP, DB-backed)
# ---------------------------------------------------------------------------


class _FakeResponse:
  def __init__(self, payload: list[dict[str, Any]]) -> None:
    self._payload = payload

  def raise_for_status(self) -> None:
    return None

  def json(self) -> list[dict[str, Any]]:
    return self._payload


class _FakeClient:
  def __init__(self, payload: list[dict[str, Any]], **kwargs: Any) -> None:
    self._payload = payload

  async def __aenter__(self) -> "_FakeClient":
    return self

  async def __aexit__(self, *args: Any) -> None:
    return None

  async def get(self, url: str) -> _FakeResponse:
    return _FakeResponse(self._payload)


def _patch_feed(monkeypatch: pytest.MonkeyPatch, payload: list[dict[str, Any]]) -> None:
  def factory(**kwargs: Any) -> _FakeClient:
    return _FakeClient(payload, **kwargs)

  monkeypatch.setattr(news_service.httpx, "AsyncClient", factory)


async def test_sync_current_week_inserts_events(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  _patch_feed(
    monkeypatch,
    [
      _raw(title="Core CPI m/m", date="2026-06-10T08:30:00-04:00", impact="High"),
      _raw(title="NFP", date="2026-06-12T08:30:00-04:00", impact="High"),
    ],
  )
  result = await news_service.sync_current_week()
  assert result["synced"] == 2
  assert result["week_start"] == "2026-06-08T00:00:00+00:00"
  assert result["week_end"] == "2026-06-14T23:59:59+00:00"

  loaded = await news_service.load_news_for_period(
    "2026-06-08T00:00:00+00:00", "2026-06-14T23:59:59+00:00"
  )
  assert {e.title for e in loaded} == {"Core CPI m/m", "NFP"}


async def test_sync_replace_strategy_removes_cancelled_events(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  # First sync: two events in the week.
  _patch_feed(
    monkeypatch,
    [
      _raw(title="Core CPI m/m", date="2026-06-10T08:30:00-04:00"),
      _raw(title="Cancelled Event", date="2026-06-11T08:30:00-04:00"),
    ],
  )
  await news_service.sync_current_week()

  # Second sync: "Cancelled Event" disappeared from the feed.
  _patch_feed(
    monkeypatch,
    [_raw(title="Core CPI m/m", date="2026-06-10T08:30:00-04:00")],
  )
  result = await news_service.sync_current_week()
  assert result["synced"] == 1

  loaded = await news_service.load_news_for_period(
    "2026-06-08T00:00:00+00:00", "2026-06-14T23:59:59+00:00"
  )
  assert [e.title for e in loaded] == ["Core CPI m/m"]


async def test_load_news_filters_by_currency_and_impact(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  _patch_feed(
    monkeypatch,
    [
      _raw(title="Core CPI m/m", country="USD", date="2026-06-10T08:30:00-04:00", impact="High"),
      _raw(title="ECB Speech", country="EUR", date="2026-06-11T08:30:00-04:00", impact="Low"),
      _raw(title="GDP", country="USD", date="2026-06-12T08:30:00-04:00", impact="Medium"),
    ],
  )
  await news_service.sync_current_week()
  start, end = "2026-06-08T00:00:00+00:00", "2026-06-14T23:59:59+00:00"

  usd_only = await news_service.load_news_for_period(start, end, currencies=["USD"])
  assert {e.title for e in usd_only} == {"Core CPI m/m", "GDP"}

  high_impact = await news_service.load_news_for_period(start, end, min_impact="MEDIUM")
  assert {e.title for e in high_impact} == {"Core CPI m/m", "GDP"}


async def test_is_sync_stale(db: Any) -> None:
  from app.repositories import news_repository

  # Never synced.
  assert await news_service.is_sync_stale() is True

  # Fresh sync.
  fresh = _event()
  fresh.synced_at = datetime.now(timezone.utc).isoformat()
  await news_repository.save_events([fresh])
  assert await news_service.is_sync_stale(max_age_hours=12) is False

  # Stale sync.
  stale = _event(title="Old", date="2026-06-11T12:30:00+00:00")
  stale.synced_at = (datetime.now(timezone.utc) - timedelta(hours=13)).isoformat()
  await news_repository.delete_for_period(
    "2026-06-01T00:00:00+00:00", "2026-06-30T00:00:00+00:00"
  )
  await news_repository.save_events([stale])
  assert await news_service.is_sync_stale(max_age_hours=12) is True
