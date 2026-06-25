"""Tests for GET /api/massive/tickers (issue #186)."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import massive_service


def test_search_tickers_returns_matches(monkeypatch: pytest.MonkeyPatch) -> None:
  async def fake_search(query: str, market: str) -> list[dict]:
    assert query == "EUR"
    assert market == "fx"
    return [
      {
        "ticker": "C:EURUSD",
        "name": "Euro / United States Dollar",
        "market": "fx",
        "locale": "global",
        "currency_name": "United States Dollar",
        "active": True,
      }
    ]

  monkeypatch.setattr(massive_service, "search_tickers", fake_search)

  with TestClient(app) as client:
    response = client.get("/api/massive/tickers", params={"search": "EUR"})

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  assert body["data"] == [
    {
      "ticker": "C:EURUSD",
      "name": "Euro / United States Dollar",
      "market": "fx",
      "active": True,
    }
  ]


def test_search_tickers_defaults_to_fx(monkeypatch: pytest.MonkeyPatch) -> None:
  seen: dict[str, str] = {}

  async def fake_search(query: str, market: str) -> list[dict]:
    seen["market"] = market
    return []

  monkeypatch.setattr(massive_service, "search_tickers", fake_search)

  with TestClient(app) as client:
    response = client.get("/api/massive/tickers", params={"search": "EUR"})

  assert response.status_code == 200
  assert seen["market"] == "fx"


def test_search_tickers_passes_explicit_market(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  seen: dict[str, str] = {}

  async def fake_search(query: str, market: str) -> list[dict]:
    seen["market"] = market
    return []

  monkeypatch.setattr(massive_service, "search_tickers", fake_search)

  with TestClient(app) as client:
    response = client.get(
      "/api/massive/tickers", params={"search": "BTC", "market": "crypto"}
    )

  assert response.status_code == 200
  assert seen["market"] == "crypto"


def test_search_tickers_too_short_returns_400() -> None:
  with TestClient(app) as client:
    response = client.get("/api/massive/tickers", params={"search": "E"})

  assert response.status_code == 400
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_search_tickers_invalid_market_returns_400() -> None:
  with TestClient(app) as client:
    response = client.get(
      "/api/massive/tickers", params={"search": "EUR", "market": "bonds"}
    )

  assert response.status_code == 400
  assert response.json()["error"] is not None


def test_search_tickers_without_api_key_returns_empty() -> None:
  # No Massive API key is configured in the test database, so the real
  # service short-circuits and returns an empty list without any error.
  with TestClient(app) as client:
    response = client.get("/api/massive/tickers", params={"search": "EUR"})

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  assert body["data"] == []
