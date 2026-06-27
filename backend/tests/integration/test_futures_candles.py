"""Integration tests for the Futures multi-contract candle pipeline (issue #205-D).

Covers the full path: contract resolution (entry + exit) -> candle fetch ->
parquet storage with a `symbol` column -> merged chart response. The Massive
Contracts and Aggregates APIs are mocked; everything else is exercised end to
end through the public GET /api/trades/{id}/candles endpoint.
"""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import candle_service, massive_service

# Two NQ contracts whose trading windows overlap during the March roll. A trade
# opening 2026-03-10 belongs to the front month NQH26; closing 2026-06-25 falls
# in NQM26 (NQH26 has expired by then).
NQH26 = {"ticker": "NQH26", "first_trade_date": "2025-12-15", "last_trade_date": "2026-03-20"}
NQM26 = {"ticker": "NQM26", "first_trade_date": "2026-03-09", "last_trade_date": "2026-06-30"}


@pytest.fixture(autouse=True)
def isolated_candles_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
  """Redirect CANDLES_DIR to a temp dir so the real data dir is untouched."""
  monkeypatch.setattr(candle_service, "CANDLES_DIR", str(tmp_path / "candles"))


def _ms(year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> int:
  """Unix milliseconds for a UTC wall-clock time."""
  return int(
    datetime(year, month, day, hour, minute, tzinfo=timezone.utc).timestamp() * 1000
  )


def _set_massive_ticker(asset_id: int, ticker: str) -> None:
  """Set an asset's massive_ticker directly (not exposed via the API)."""
  connection = sqlite3.connect(os.environ["KIROKU_DB_PATH"])
  connection.execute(
    "UPDATE assets SET massive_ticker = ? WHERE id = ?", (ticker, asset_id)
  )
  connection.commit()
  connection.close()


def _create_futures_asset(client: TestClient, name: str = "Nasdaq 100") -> int:
  response = client.post(
    "/api/assets", json={"name": name, "category": "Futures", "currency": "USD"}
  )
  assert response.status_code == 201, response.text
  return response.json()["data"]["id"]


def _create_spanning_trade(client: TestClient, asset_id: int) -> int:
  """Create a trade opening on 2026-03-10 and closing on 2026-06-25."""
  response = client.post(
    "/api/trades",
    json={
      "asset_id": asset_id,
      "activities": [
        {"type": "Buy", "price": 18000.0, "quantity": 1.0, "date": "2026-03-10"},
        {"type": "Sell", "price": 19000.0, "quantity": 1.0, "date": "2026-06-25"},
      ],
    },
  )
  assert response.status_code == 201, response.text
  return response.json()["data"]["id"]


def _candle_for(ticker: str) -> dict:
  """A single normalized M1 candle placed inside *ticker*'s active window."""
  if ticker == "NQH26":
    ts = _ms(2026, 3, 12, 14, 30)
  else:  # NQM26
    ts = _ms(2026, 6, 22, 14, 30)
  return {"o": 1.0, "h": 1.2, "l": 0.9, "c": 1.1, "v": 100.0, "t": ts}


# ---------------------------------------------------------------------------
# Multi-contract accumulation
# ---------------------------------------------------------------------------


def test_trade_spanning_two_contracts_stores_both(monkeypatch: pytest.MonkeyPatch) -> None:
  """A trade crossing the contract boundary stores both contracts in one file."""

  async def fake_contracts(product_code: str, date_str: str) -> list[dict]:
    assert product_code == "NQ"
    # Return the full set; the resolver picks the contract active on date_str.
    return [NQH26, NQM26]

  fetched: list[str] = []

  async def fake_fetch(ticker: str, date_from: str, date_to: str) -> list[dict]:
    fetched.append(ticker)
    return [_candle_for(ticker)]

  monkeypatch.setattr(massive_service, "fetch_contracts", fake_contracts)
  monkeypatch.setattr(massive_service, "fetch_candles", fake_fetch)

  with TestClient(app) as client:
    asset_id = _create_futures_asset(client)
    _set_massive_ticker(asset_id, "NQ")
    trade_id = _create_spanning_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")

  assert response.status_code == 200, response.text
  data = response.json()["data"]

  # Both contracts were resolved and fetched.
  assert sorted(fetched) == ["NQH26", "NQM26"]
  # The chart reports the entry contract and returns the merged candles.
  assert data["ticker"] == "NQH26"
  timestamps = sorted(c["timestamp"] for c in data["candles"])
  assert timestamps == [_ms(2026, 3, 12, 14, 30), _ms(2026, 6, 22, 14, 30)]

  # Both contracts live in the single base-product parquet file, distinguished
  # by the symbol column.
  assert candle_service._candle_path("NQ").exists()
  h26 = candle_service.read_candles("NQ", 0, _ms(2027, 1, 1), symbol="NQH26")
  m26 = candle_service.read_candles("NQ", 0, _ms(2027, 1, 1), symbol="NQM26")
  assert [c["timestamp"] for c in h26] == [_ms(2026, 3, 12, 14, 30)]
  assert [c["timestamp"] for c in m26] == [_ms(2026, 6, 22, 14, 30)]


def test_chart_request_returns_merged_candles_from_storage(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  """With both contracts already stored, the chart merges them without refetch."""
  def _stored(ts: int, symbol: str, base: float) -> dict:
    return {
      "timestamp": ts,
      "symbol": symbol,
      "open": base,
      "high": base + 0.2,
      "low": base - 0.1,
      "close": base + 0.1,
      "volume": base * 100.0,
    }

  candle_service.store_candles(
    "NQ",
    [
      _stored(_ms(2026, 3, 12, 14, 30), "NQH26", 1.0),
      _stored(_ms(2026, 6, 22, 14, 30), "NQM26", 2.0),
    ],
  )

  def fail_contracts(*args: object, **kwargs: object) -> list[dict]:
    raise AssertionError("contracts must not be resolved when candles are stored")

  def fail_fetch(*args: object, **kwargs: object) -> list[dict]:
    raise AssertionError("candles must not be refetched when already stored")

  monkeypatch.setattr(massive_service, "fetch_contracts", fail_contracts)
  monkeypatch.setattr(massive_service, "fetch_candles", fail_fetch)

  with TestClient(app) as client:
    asset_id = _create_futures_asset(client)
    _set_massive_ticker(asset_id, "NQ")
    trade_id = _create_spanning_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")

  data = response.json()["data"]
  assert len(data["candles"]) == 2
  assert response.json()["meta"] is None
  # The chart ticker is recovered from the stored `symbol` column (the contract
  # nearest the entry date), not from a Massive contract resolution.
  assert data["ticker"] == "NQH26"


# ---------------------------------------------------------------------------
# Graceful fallback — exit contract not found
# ---------------------------------------------------------------------------


def test_exit_contract_unresolved_falls_back_to_entry(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  """When the exit contract cannot be resolved, the entry contract still charts."""

  async def fake_contracts(product_code: str, date_str: str) -> list[dict]:
    # Only the entry contract is known; it does not cover the June exit date.
    return [NQH26]

  fetched: list[str] = []

  async def fake_fetch(ticker: str, date_from: str, date_to: str) -> list[dict]:
    fetched.append(ticker)
    return [_candle_for(ticker)]

  monkeypatch.setattr(massive_service, "fetch_contracts", fake_contracts)
  monkeypatch.setattr(massive_service, "fetch_candles", fake_fetch)

  with TestClient(app) as client:
    asset_id = _create_futures_asset(client)
    _set_massive_ticker(asset_id, "NQ")
    trade_id = _create_spanning_trade(client, asset_id)
    response = client.get(f"/api/trades/{trade_id}/candles?resolution=M1")

  assert response.status_code == 200, response.text
  data = response.json()["data"]

  # No crash: only the entry contract was fetched and charted.
  assert fetched == ["NQH26"]
  assert data["ticker"] == "NQH26"
  assert [c["timestamp"] for c in data["candles"]] == [_ms(2026, 3, 12, 14, 30)]
  # Only the entry contract is in storage.
  assert candle_service.read_candles("NQ", 0, _ms(2027, 1, 1), symbol="NQM26") == []
