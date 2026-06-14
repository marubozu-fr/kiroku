"""Tests for the news API routes (GET /api/news, /sync, /status)."""
import os
import sqlite3
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import news_service

_DB_PATH = os.environ["KIROKU_DB_PATH"]


def _recent_iso(hours_ago: float = 0) -> str:
  return (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()


def _insert_event(
  event_id: str,
  *,
  date: str = "2026-06-10T12:30:00+00:00",
  title: str = "Core CPI m/m",
  currency: str = "USD",
  impact: str = "HIGH",
  forecast: str = "0.3%",
  previous: str = "0.4%",
  synced_at: str | None = None,
) -> None:
  """Insert one news event straight into the test database."""
  connection = sqlite3.connect(_DB_PATH)
  connection.execute(
    """
    INSERT INTO news_events
      (id, date, title, currency, impact, forecast, previous, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """,
    (event_id, date, title, currency, impact, forecast, previous,
     synced_at or _recent_iso()),
  )
  connection.commit()
  connection.close()


# ---------------------------------------------------------------------------
# GET /api/news — filtering
# ---------------------------------------------------------------------------


def test_get_news_returns_events_in_envelope() -> None:
  _insert_event("e1", currency="USD", impact="HIGH")
  _insert_event("e2", currency="JPY", impact="MEDIUM", title="BOJ Rate")

  with TestClient(app) as client:
    response = client.get("/api/news", params={"start": "2026-06-09", "end": "2026-06-15"})

  assert response.status_code == 200
  body = response.json()
  assert body["meta"] == {"count": 2, "start": "2026-06-09", "end": "2026-06-15"}
  ids = {event["id"] for event in body["data"]}
  assert ids == {"e1", "e2"}
  # The internal synced_at field is not exposed.
  assert "synced_at" not in body["data"][0]


def test_get_news_excludes_impact_below_minimum() -> None:
  # Default min_impact is MEDIUM, so a LOW event is filtered out.
  _insert_event("high", impact="HIGH")
  _insert_event("low", impact="LOW", title="Trade Balance")

  with TestClient(app) as client:
    response = client.get("/api/news", params={"start": "2026-06-09", "end": "2026-06-15"})

  ids = {event["id"] for event in response.json()["data"]}
  assert ids == {"high"}


def test_get_news_filters_by_currency_preference() -> None:
  _insert_event("usd", currency="USD")
  _insert_event("eur", currency="EUR", title="ECB Press Conference")

  with TestClient(app) as client:
    client.patch("/api/preferences", json={"news_currencies": ["USD"]})
    response = client.get("/api/news", params={"start": "2026-06-09", "end": "2026-06-15"})

  ids = {event["id"] for event in response.json()["data"]}
  assert ids == {"usd"}


def test_get_news_includes_last_day_of_range() -> None:
  # An event late on the end day must still be inclusive of the date bound.
  _insert_event("late", date="2026-06-15T22:00:00+00:00")

  with TestClient(app) as client:
    response = client.get("/api/news", params={"start": "2026-06-09", "end": "2026-06-15"})

  assert {event["id"] for event in response.json()["data"]} == {"late"}


def test_get_news_disabled_returns_empty() -> None:
  _insert_event("e1")

  with TestClient(app) as client:
    client.patch("/api/preferences", json={"news_enabled": False})
    response = client.get("/api/news", params={"start": "2026-06-09", "end": "2026-06-15"})

  assert response.status_code == 200
  body = response.json()
  assert body["data"] == []
  assert body["meta"]["count"] == 0


def test_get_news_requires_start_and_end() -> None:
  with TestClient(app) as client:
    response = client.get("/api/news", params={"start": "2026-06-09"})

  assert response.status_code == 422


def test_get_news_rejects_invalid_date() -> None:
  with TestClient(app) as client:
    response = client.get("/api/news", params={"start": "not-a-date", "end": "2026-06-15"})

  assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/news — auto-sync hook
# ---------------------------------------------------------------------------


def test_get_news_triggers_autosync_when_stale(monkeypatch: pytest.MonkeyPatch) -> None:
  # No events => stale. The auto-sync should fire and populate the database.
  calls = {"count": 0}

  async def fake_sync() -> dict[str, object]:
    calls["count"] += 1
    _insert_event("synced", impact="HIGH")
    return {"synced": 1, "week_start": None, "week_end": None}

  monkeypatch.setattr(news_service, "sync_current_week", fake_sync)

  with TestClient(app) as client:
    response = client.get("/api/news", params={"start": "2026-06-09", "end": "2026-06-15"})

  assert calls["count"] == 1
  assert {event["id"] for event in response.json()["data"]} == {"synced"}


def test_get_news_skips_autosync_when_fresh(monkeypatch: pytest.MonkeyPatch) -> None:
  # A freshly synced event is not stale, so no sync should be attempted.
  _insert_event("fresh", synced_at=_recent_iso(hours_ago=1))

  async def fail_sync() -> dict[str, object]:
    raise AssertionError("sync should not run when data is fresh")

  monkeypatch.setattr(news_service, "sync_current_week", fail_sync)

  with TestClient(app) as client:
    response = client.get("/api/news", params={"start": "2026-06-09", "end": "2026-06-15"})

  assert response.status_code == 200
  assert {event["id"] for event in response.json()["data"]} == {"fresh"}


def test_get_news_serves_cached_data_when_sync_fails(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  # Stale cached event + a failing sync must still return the cached data.
  _insert_event("cached", synced_at=_recent_iso(hours_ago=48))

  async def failing_sync() -> dict[str, object]:
    raise RuntimeError("network down")

  monkeypatch.setattr(news_service, "sync_current_week", failing_sync)

  with TestClient(app) as client:
    response = client.get("/api/news", params={"start": "2026-06-09", "end": "2026-06-15"})

  assert response.status_code == 200
  assert {event["id"] for event in response.json()["data"]} == {"cached"}


# ---------------------------------------------------------------------------
# POST /api/news/sync
# ---------------------------------------------------------------------------


def test_sync_endpoint_returns_result(monkeypatch: pytest.MonkeyPatch) -> None:
  async def fake_sync() -> dict[str, object]:
    return {
      "synced": 42,
      "week_start": "2026-06-08T00:00:00+00:00",
      "week_end": "2026-06-14T23:59:59+00:00",
    }

  monkeypatch.setattr(news_service, "sync_current_week", fake_sync)

  with TestClient(app) as client:
    response = client.post("/api/news/sync")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  assert body["data"]["synced"] == 42
  assert body["data"]["week_start"] == "2026-06-08T00:00:00+00:00"


# ---------------------------------------------------------------------------
# GET /api/news/status
# ---------------------------------------------------------------------------


def test_status_reports_stale_when_no_events() -> None:
  with TestClient(app) as client:
    response = client.get("/api/news/status")

  assert response.status_code == 200
  body = response.json()
  assert body["data"] == {"last_sync": None, "is_stale": True}


def test_status_reports_fresh_after_recent_sync() -> None:
  synced_at = _recent_iso(hours_ago=1)
  _insert_event("e1", synced_at=synced_at)

  with TestClient(app) as client:
    response = client.get("/api/news/status")

  body = response.json()
  assert body["data"]["last_sync"] == synced_at
  assert body["data"]["is_stale"] is False
