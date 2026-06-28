"""Tests for GET /api/trades/{id}/candles (issue #189)."""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from httpx import Response

from app.main import app
from app.services import candle_service, futures_service, massive_service


@pytest.fixture(autouse=True)
def isolated_candles_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
  """Redirect CANDLES_DIR to a temp dir so the real data dir is untouched."""
  monkeypatch.setattr(candle_service, "CANDLES_DIR", str(tmp_path / "candles"))


def _ms(year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> int:
  """Unix milliseconds for a UTC wall-clock time."""
  return int(
    datetime(year, month, day, hour, minute, tzinfo=timezone.utc).timestamp() * 1000
  )


def _candle(ts: int, o: float, h: float, lo: float, c: float, v: float) -> dict:
  return {"timestamp": ts, "open": o, "high": h, "low": lo, "close": c, "volume": v}


def _set_massive_ticker(asset_id: int, ticker: str) -> None:
  """Set an asset's massive_ticker directly (not exposed via the API)."""
  connection = sqlite3.connect(os.environ["KIROKU_DB_PATH"])
  connection.execute(
    "UPDATE assets SET massive_ticker = ? WHERE id = ?", (ticker, asset_id)
  )
  connection.commit()
  connection.close()


def _create_asset(client: TestClient, name: str = "EUR/USD") -> int:
  response = client.post(
    "/api/assets", json={"name": name, "category": "Forex", "currency": "USD"}
  )
  assert response.status_code == 201, response.text
  return response.json()["data"]["id"]


def _create_trade(
  client: TestClient,
  asset_id: int,
  *,
  stop_loss: float | None = 1.0810,
  with_exit: bool = True,
  timeframe_unit: str | None = None,
  timeframe_value: int | None = None,
) -> int:
  activities = [
    {"type": "Buy", "price": 1.0825, "quantity": 0.5, "date": "2024-03-15"},
  ]
  if with_exit:
    activities.append(
      {"type": "Sell", "price": 1.0845, "quantity": 0.5, "date": "2024-03-16"}
    )
  payload: dict = {"asset_id": asset_id, "stop_loss": stop_loss, "activities": activities}
  if timeframe_unit is not None:
    payload["timeframe_unit"] = timeframe_unit
    payload["timeframe_value"] = timeframe_value
  response = client.post("/api/trades", json=payload)
  assert response.status_code == 201, response.text
  return response.json()["data"]["id"]


# ---------------------------------------------------------------------------
# Error cases
# ---------------------------------------------------------------------------


def test_trade_not_found_returns_404() -> None:
  with TestClient(app) as client:
    response: Response = client.get("/api/trades/999/candles")
  assert response.status_code == 404
  assert response.json()["error"] is not None


def test_invalid_resolution_returns_400() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M3")
  assert response.status_code == 400
  assert response.json()["error"] is not None


def test_no_ticker_returns_null_data_with_reason() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)  # no massive_ticker set
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles")
  assert response.status_code == 200
  body = response.json()
  assert body["data"] is None
  assert body["meta"] == {"reason": "no_ticker"}


# ---------------------------------------------------------------------------
# Candle data
# ---------------------------------------------------------------------------


def test_returns_raw_m1_candles() -> None:
  candle_service.store_candles(
    "C:EURUSD",
    [
      _candle(_ms(2024, 3, 15, 9, 0), 1.0, 1.2, 0.9, 1.1, 100.0),
      _candle(_ms(2024, 3, 15, 9, 1), 1.1, 1.3, 1.0, 1.2, 120.0),
    ],
  )
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")
  body = response.json()
  data = body["data"]
  assert data["resolution"] == "M1"
  assert data["ticker"] == "C:EURUSD"
  assert len(data["candles"]) == 2
  assert body["meta"] is None


def test_candles_aggregated_at_requested_resolution() -> None:
  # Three M1 candles in the 09:00 bucket, one in the 09:15 bucket.
  candle_service.store_candles(
    "C:EURUSD",
    [
      _candle(_ms(2024, 3, 15, 9, 0), 1.00, 1.05, 0.98, 1.02, 10.0),
      _candle(_ms(2024, 3, 15, 9, 5), 1.02, 1.10, 1.01, 1.08, 12.0),
      _candle(_ms(2024, 3, 15, 9, 10), 1.08, 1.12, 1.04, 1.06, 8.0),
      _candle(_ms(2024, 3, 15, 9, 15), 1.06, 1.07, 1.03, 1.05, 5.0),
    ],
  )
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M15")
  data = response.json()["data"]
  assert data["resolution"] == "M15"
  assert len(data["candles"]) == 2
  first = data["candles"][0]
  assert first["timestamp"] == _ms(2024, 3, 15, 9, 0)
  assert first["open"] == 1.00
  assert first["high"] == 1.12
  assert first["low"] == 0.98
  assert first["close"] == 1.06
  assert first["volume"] == 30.0


def test_default_resolution_from_trade_timeframe() -> None:
  candle_service.store_candles(
    "C:EURUSD", [_candle(_ms(2024, 3, 15, 9, 0), 1.0, 1.2, 0.9, 1.1, 100.0)]
  )
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(
      client, asset_id, timeframe_unit="h", timeframe_value=1
    )
    response = client.get(f"/api/trades/{trade_id}/candles")
  assert response.json()["data"]["resolution"] == "H1"


# ---------------------------------------------------------------------------
# Markers and levels
# ---------------------------------------------------------------------------


def test_markers_and_levels_included() -> None:
  candle_service.store_candles(
    "C:EURUSD", [_candle(_ms(2024, 3, 15, 9, 0), 1.0, 1.2, 0.9, 1.1, 100.0)]
  )
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id, stop_loss=1.0810)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")
  data = response.json()["data"]

  markers = data["markers"]
  assert len(markers) == 2
  entry = next(m for m in markers if m["type"] == "entry")
  exit_ = next(m for m in markers if m["type"] == "exit")
  assert entry["side"] == "Buy"
  assert entry["price"] == 1.0825
  assert entry["timestamp"] == _ms(2024, 3, 15)
  assert exit_["side"] == "Sell"
  assert exit_["timestamp"] == _ms(2024, 3, 16)

  assert data["levels"]["stop_loss"] == 1.0810
  assert data["levels"]["take_profits"] == []


def test_no_activities_still_returns_candles() -> None:
  candle_service.store_candles(
    "C:EURUSD", [_candle(_ms(2024, 3, 15, 9, 0), 1.0, 1.2, 0.9, 1.1, 100.0)]
  )
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    # A single-entry trade still has one activity -> one marker; the edge case
    # we cover is that candles are returned regardless of marker count.
    trade_id = _create_trade(client, asset_id, with_exit=False)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")
  data = response.json()["data"]
  assert len(data["candles"]) == 1
  assert len(data["markers"]) == 1


# ---------------------------------------------------------------------------
# Lazy fetch fallback
# ---------------------------------------------------------------------------


def test_lazy_fetch_when_no_stored_candles(monkeypatch: pytest.MonkeyPatch) -> None:
  async def fake_fetch(ticker: str, date_from: str, date_to: str) -> list[dict]:
    return [
      {"o": 1.0, "h": 1.2, "l": 0.9, "c": 1.1, "v": 100.0, "t": _ms(2024, 3, 15, 9, 0)},
      {"o": 1.1, "h": 1.3, "l": 1.0, "c": 1.2, "v": 120.0, "t": _ms(2024, 3, 15, 9, 1)},
    ]

  monkeypatch.setattr(massive_service, "fetch_candles", fake_fetch)
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")
  data = response.json()["data"]
  assert len(data["candles"]) == 2
  # The fetched candles were persisted to parquet storage.
  stored = candle_service.read_candles(
    "C:EURUSD", _ms(2024, 3, 8), _ms(2024, 3, 23)
  )
  assert len(stored) == 2


def test_empty_candles_reports_pending(monkeypatch: pytest.MonkeyPatch) -> None:
  async def fake_fetch(ticker: str, date_from: str, date_to: str) -> list[dict]:
    return []

  monkeypatch.setattr(massive_service, "fetch_candles", fake_fetch)
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")
  body = response.json()
  assert body["data"]["candles"] == []
  assert body["meta"] == {"reason": "pending"}


# ---------------------------------------------------------------------------
# Futures contract resolution (issue #208)
# ---------------------------------------------------------------------------


def _create_futures_asset(client: TestClient, name: str = "Nasdaq 100") -> int:
  response = client.post(
    "/api/assets", json={"name": name, "category": "Futures", "currency": "USD"}
  )
  assert response.status_code == 201, response.text
  return response.json()["data"]["id"]


def test_futures_asset_resolves_contract_then_fetches_candles(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  # The base symbol "NQ" must be resolved to the active contract before candles
  # are fetched, and the resolved ticker must drive storage + response.
  async def fake_contracts(product_code: str, date_str: str) -> list[dict]:
    assert product_code == "NQ"
    return [
      {"ticker": "NQH24", "first_trade_date": "2023-12-15", "last_trade_date": "2024-03-20"}
    ]

  fetched: list[str] = []

  async def fake_fetch(ticker: str, date_from: str, date_to: str) -> list[dict]:
    fetched.append(ticker)
    return [
      {"o": 1.0, "h": 1.2, "l": 0.9, "c": 1.1, "v": 100.0, "t": _ms(2024, 3, 15, 9, 0)},
    ]

  monkeypatch.setattr(massive_service, "fetch_contracts", fake_contracts)
  monkeypatch.setattr(massive_service, "fetch_candles", fake_fetch)

  with TestClient(app) as client:
    asset_id = _create_futures_asset(client)
    _set_massive_ticker(asset_id, "NQ")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")

  data = response.json()["data"]
  assert data["ticker"] == "NQH24"
  assert len(data["candles"]) == 1
  # Candles were fetched for the resolved contract, not the base symbol.
  assert fetched == ["NQH24"]


def test_futures_day_trade_resolves_contract_once(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  # A day trade (entry and exit on the same date) must resolve the contract only
  # once — the exit resolution is skipped because the contract is identical.
  resolved: list[str] = []

  async def fake_contracts(product_code: str, date_str: str) -> list[dict]:
    resolved.append(date_str)
    return [
      {"ticker": "NQH24", "first_trade_date": "2023-12-15", "last_trade_date": "2024-03-20"}
    ]

  async def fake_fetch(ticker: str, date_from: str, date_to: str) -> list[dict]:
    return [
      {"o": 1.0, "h": 1.2, "l": 0.9, "c": 1.1, "v": 100.0, "t": _ms(2024, 3, 15, 9, 0)},
    ]

  monkeypatch.setattr(massive_service, "fetch_contracts", fake_contracts)
  monkeypatch.setattr(massive_service, "fetch_candles", fake_fetch)

  with TestClient(app) as client:
    asset_id = _create_futures_asset(client)
    _set_massive_ticker(asset_id, "NQ")
    # Single-day trade: both activities on 2024-03-15.
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "activities": [
          {"type": "Buy", "price": 18000.0, "quantity": 1.0, "date": "2024-03-15"},
          {"type": "Sell", "price": 18100.0, "quantity": 1.0, "date": "2024-03-15"},
        ],
      },
    )
    assert response.status_code == 201, response.text
    trade_id = response.json()["data"]["id"]
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")

  assert response.status_code == 200, response.text
  assert response.json()["data"]["ticker"] == "NQH24"
  # resolve_contract was called exactly once despite an entry and an exit.
  assert resolved == ["2024-03-15"]


def test_futures_stored_candles_skip_contract_resolution(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  # When candles for the base product already exist in parquet, the chart must
  # be built from storage without any Massive contract resolution or fetch.
  candle_service.store_candles(
    "NQ",
    [
      {
        "timestamp": _ms(2024, 3, 15, 9, 0),
        "symbol": "NQH24",
        "open": 1.0,
        "high": 1.2,
        "low": 0.9,
        "close": 1.1,
        "volume": 100.0,
      }
    ],
  )

  def fail_contracts(*args: object, **kwargs: object) -> list[dict]:
    raise AssertionError("contracts must not be resolved when candles are stored")

  def fail_fetch(*args: object, **kwargs: object) -> list[dict]:
    raise AssertionError("candles must not be fetched when already stored")

  monkeypatch.setattr(massive_service, "fetch_contracts", fail_contracts)
  monkeypatch.setattr(massive_service, "fetch_candles", fail_fetch)

  with TestClient(app) as client:
    asset_id = _create_futures_asset(client)
    _set_massive_ticker(asset_id, "NQ")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")

  data = response.json()["data"]
  assert data["ticker"] == "NQH24"
  assert len(data["candles"]) == 1


def test_futures_asset_unresolved_contract_returns_meta(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  async def fake_contracts(product_code: str, date_str: str) -> list[dict]:
    return []

  def fail_fetch(*args: object, **kwargs: object) -> list[dict]:
    raise AssertionError("candles must not be fetched when resolution fails")

  monkeypatch.setattr(massive_service, "fetch_contracts", fake_contracts)
  monkeypatch.setattr(massive_service, "fetch_candles", fail_fetch)

  with TestClient(app) as client:
    asset_id = _create_futures_asset(client)
    _set_massive_ticker(asset_id, "NQ")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")

  body = response.json()
  assert body["data"] is None
  assert body["meta"] == {"reason": "contract_unresolved"}


def test_futures_asset_without_ticker_short_circuits(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  def fail_contracts(*args: object, **kwargs: object) -> list[dict]:
    raise AssertionError("contract resolution must not run without a ticker")

  monkeypatch.setattr(futures_service.massive_service, "fetch_contracts", fail_contracts)

  with TestClient(app) as client:
    asset_id = _create_futures_asset(client)  # no massive_ticker set
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")

  body = response.json()
  assert body["data"] is None
  assert body["meta"] == {"reason": "no_ticker"}


# ---------------------------------------------------------------------------
# Arbitrary TradingView resolution tokens (issue #236)
# ---------------------------------------------------------------------------


def test_resolution_3m_returns_200_and_aggregates_into_buckets() -> None:
  """resolution='3m' is accepted and candles are grouped into 3-minute buckets.

  09:00 UTC is always on a 3-minute boundary (32400 s / 180 s = 180 exactly),
  so candles at 09:00-09:02 fall in one bucket and 09:03-09:05 in the next.
  """
  candle_service.store_candles(
    "C:EURUSD",
    [
      _candle(_ms(2024, 3, 15, 9, 0), 1.00, 1.10, 0.90, 1.05, 10.0),
      _candle(_ms(2024, 3, 15, 9, 1), 1.05, 1.15, 0.95, 1.10, 10.0),
      _candle(_ms(2024, 3, 15, 9, 2), 1.10, 1.20, 1.00, 1.15, 10.0),
      _candle(_ms(2024, 3, 15, 9, 3), 1.15, 1.25, 1.05, 1.20, 20.0),
      _candle(_ms(2024, 3, 15, 9, 4), 1.20, 1.30, 1.10, 1.25, 20.0),
      _candle(_ms(2024, 3, 15, 9, 5), 1.25, 1.35, 1.15, 1.30, 20.0),
    ],
  )
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=3m")
  assert response.status_code == 200
  data = response.json()["data"]
  assert data["resolution"] == "3m"
  assert len(data["candles"]) == 2
  assert data["candles"][0]["volume"] == 30.0
  assert data["candles"][1]["volume"] == 60.0


def test_resolution_12h_returns_200_with_correct_token() -> None:
  """resolution='12h' is accepted and the exact token is echoed in the response."""
  candle_service.store_candles(
    "C:EURUSD",
    [_candle(_ms(2024, 3, 15, 9, 0), 1.0, 1.2, 0.9, 1.1, 100.0)],
  )
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=12h")
  assert response.status_code == 200
  data = response.json()["data"]
  assert data["resolution"] == "12h"


def test_resolution_1D_tradingview_day_token_returns_200() -> None:
  """resolution='1D' (TradingView notation, distinct from legacy 'D1') is accepted."""
  candle_service.store_candles(
    "C:EURUSD",
    [_candle(_ms(2024, 3, 15, 9, 0), 1.0, 1.2, 0.9, 1.1, 100.0)],
  )
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=1D")
  assert response.status_code == 200
  data = response.json()["data"]
  assert data["resolution"] == "1D"


def test_resolution_W1_invalid_token_returns_400() -> None:
  """resolution='W1' (invalid legacy-style token) is rejected with HTTP 400."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _set_massive_ticker(asset_id, "C:EURUSD")
    trade_id = _create_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=W1")
  assert response.status_code == 400
  assert response.json()["error"] is not None
