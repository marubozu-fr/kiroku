import pytest
from fastapi.testclient import TestClient
from httpx import Response

from app.main import app

# ---------------------------------------------------------------------------
# Shared helpers (copied from test_trades.py — no cross-file imports)
# ---------------------------------------------------------------------------


def _create_asset(client: TestClient, name: str = "EURUSD", category: str = "Forex") -> int:
  resp = client.post("/api/assets", json={"name": name, "category": category})
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _create(client: TestClient, asset_id: int, **overrides: object) -> Response:
  payload: dict = {
    "asset_id": asset_id,
    "activities": [
      {"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-03-15"},
    ],
  }
  payload.update(overrides)
  return client.post("/api/trades", json=payload)


# ---------------------------------------------------------------------------
# 1. Normal case — mix of winners, losers, and one open (null perf_r) trade
# ---------------------------------------------------------------------------


def test_year_statistics_normal_case_mixed_trades() -> None:
  """
  Year 2024 has four trades:

  Trade A (winner +2R):
    Long, Buy 100.0 qty=1, stop=90.0, Sell 120.0 qty=1
    risk = |100 - 90| = 10, reward = 120 - 100 = 20 → perf_r = +2.0

  Trade B (winner +1R):
    Long, Buy 100.0 qty=1, stop=90.0, Sell 110.0 qty=1
    risk = 10, reward = 10 → perf_r = +1.0

  Trade C (loser -1R):
    Long, Buy 100.0 qty=1, stop=90.0, Sell 90.0 qty=1
    risk = 10, reward = -10 → perf_r = -1.0
    Note: exit == stop → reward = 90-100 = -10; stop≠entry so not Breakeven

  Trade D (open, null perf_r):
    Long, Buy 100.0 qty=1, no exit — counts in total_trades only

  Derived:
    perfs = [+2.0, +1.0, -1.0], n = 3
    total_trades = 4
    winning = 2, losing = 1, breakeven = 0
    total_pnl   = round(2+1-1, 2) = 2.0
    avg_pnl     = round(2/3, 2) = 0.67
    win_rate    = round(2/3 * 100, 2) = 66.67
    avg_win     = (2+1)/2 = 1.5
    avg_loss    = 1.0
    win_frac    = 2/3, loss_frac = 1/3
    expectancy  = round(2/3*1.5 - 1/3*1.0, 2) = round(1.0 - 0.3333, 2) = 0.67
    profits     = 3.0, losses = 1.0
    profit_factor = round(3.0/1.0, 2) = 3.0
  """
  with TestClient(app) as client:
    asset_id = _create_asset(client)

    # Trade A: +2R winner
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-01-10"},
          {"type": "Sell", "price": 120.0, "quantity": 1.0, "date": "2024-01-11"},
        ],
      },
    )

    # Trade B: +1R winner
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-02-10"},
          {"type": "Sell", "price": 110.0, "quantity": 1.0, "date": "2024-02-11"},
        ],
      },
    )

    # Trade C: -1R loser
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-03-10"},
          {"type": "Sell", "price": 90.0, "quantity": 1.0, "date": "2024-03-11"},
        ],
      },
    )

    # Trade D: open trade (null perf_r) — no stop_loss, no exit
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-04-01"},
        ],
      },
    )

    response = client.get("/api/trades/statistics/2024")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  data = body["data"]

  assert data["total_trades"] == 4
  assert data["winning_trades"] == 2
  assert data["losing_trades"] == 1
  assert data["breakeven_trades"] == 0
  assert data["total_pnl"] == pytest.approx(2.0)
  assert data["avg_pnl"] == pytest.approx(0.67)
  assert data["win_rate"] == pytest.approx(66.67)
  assert data["expectancy"] == pytest.approx(0.67)
  assert data["profit_factor"] == pytest.approx(3.0)


# ---------------------------------------------------------------------------
# 2. Empty year — no trades → all fields zero
# ---------------------------------------------------------------------------


def test_year_statistics_empty_year() -> None:
  """No trades exist for 2030; every numeric field must be 0 / 0.0."""
  with TestClient(app) as client:
    response = client.get("/api/trades/statistics/2030")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  data = body["data"]

  assert data["total_trades"] == 0
  assert data["winning_trades"] == 0
  assert data["losing_trades"] == 0
  assert data["breakeven_trades"] == 0
  assert data["total_pnl"] == pytest.approx(0.0)
  assert data["avg_pnl"] == pytest.approx(0.0)
  assert data["win_rate"] == pytest.approx(0.0)
  assert data["expectancy"] == pytest.approx(0.0)
  assert data["profit_factor"] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# 3. Year with no winning trades — only losers
# ---------------------------------------------------------------------------


def test_year_statistics_only_losing_trades() -> None:
  """
  Year 2024 has two losing trades only:

  Trade A (-2R loser):
    Long, Buy 100.0 qty=1, stop=90.0, Sell 80.0 qty=1
    risk = 10, reward = 80-100 = -20 → perf_r = -2.0

  Trade B (-0.5R loser):
    Long, Buy 100.0 qty=1, stop=90.0, Sell 95.0 qty=1
    risk = 10, reward = 95-100 = -5 → perf_r = -0.5

  Derived:
    perfs = [-2.0, -0.5], n = 2
    total_trades = 2
    winning = 0, losing = 2, breakeven = 0
    total_pnl   = round(-2.5, 2) = -2.5
    avg_pnl     = round(-2.5/2, 2) = -1.25
    win_rate    = 0.0
    avg_win     = 0.0 (no winners), avg_loss = (2.0+0.5)/2 = 1.25
    win_frac    = 0, loss_frac = 1
    expectancy  = round(0*0 - 1*1.25, 2) = -1.25
    profits     = 0.0, losses = 2.5
    profit_factor = round(0/2.5, 2) = 0.0
  """
  with TestClient(app) as client:
    asset_id = _create_asset(client)

    # Trade A: -2R loser
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-05-01"},
          {"type": "Sell", "price": 80.0, "quantity": 1.0, "date": "2024-05-02"},
        ],
      },
    )

    # Trade B: -0.5R loser
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-06-01"},
          {"type": "Sell", "price": 95.0, "quantity": 1.0, "date": "2024-06-02"},
        ],
      },
    )

    response = client.get("/api/trades/statistics/2024")

  assert response.status_code == 200
  data = response.json()["data"]

  assert data["total_trades"] == 2
  assert data["winning_trades"] == 0
  assert data["losing_trades"] == 2
  assert data["breakeven_trades"] == 0
  assert data["total_pnl"] == pytest.approx(-2.5)
  assert data["avg_pnl"] == pytest.approx(-1.25)
  assert data["win_rate"] == pytest.approx(0.0)
  assert data["expectancy"] == pytest.approx(-1.25)
  assert data["profit_factor"] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# 4. Year with no losing trades — only winners (no-losses branch of profit_factor)
# ---------------------------------------------------------------------------


def test_year_statistics_only_winning_trades() -> None:
  """
  Year 2024 has two winning trades only:

  Trade A (+2R winner):
    Long, Buy 100.0 qty=1, stop=90.0, Sell 120.0 qty=1
    risk = 10, reward = 20 → perf_r = +2.0

  Trade B (+1.5R winner):
    Long, Buy 100.0 qty=1, stop=90.0, Sell 115.0 qty=1
    risk = 10, reward = 15 → perf_r = +1.5

  Derived:
    perfs = [+2.0, +1.5], n = 2
    total_trades = 2
    winning = 2, losing = 0, breakeven = 0
    total_pnl   = round(3.5, 2) = 3.5
    avg_pnl     = round(3.5/2, 2) = 1.75
    win_rate    = 100.0
    avg_win     = 1.75, avg_loss = 0.0
    win_frac    = 1, loss_frac = 0
    expectancy  = round(1*1.75 - 0*0, 2) = 1.75
    profits     = 3.5, losses = 0.0
    profit_factor = round(total_profits, 2) = 3.5   (no-losses branch)
  """
  with TestClient(app) as client:
    asset_id = _create_asset(client)

    # Trade A: +2R winner
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-07-01"},
          {"type": "Sell", "price": 120.0, "quantity": 1.0, "date": "2024-07-02"},
        ],
      },
    )

    # Trade B: +1.5R winner
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-08-01"},
          {"type": "Sell", "price": 115.0, "quantity": 1.0, "date": "2024-08-02"},
        ],
      },
    )

    response = client.get("/api/trades/statistics/2024")

  assert response.status_code == 200
  data = response.json()["data"]

  assert data["total_trades"] == 2
  assert data["winning_trades"] == 2
  assert data["losing_trades"] == 0
  assert data["breakeven_trades"] == 0
  assert data["total_pnl"] == pytest.approx(3.5)
  assert data["avg_pnl"] == pytest.approx(1.75)
  assert data["win_rate"] == pytest.approx(100.0)
  assert data["expectancy"] == pytest.approx(1.75)
  # No losses → profit_factor = round(total_profits, 2) = 3.5
  assert data["profit_factor"] == pytest.approx(3.5)


# ---------------------------------------------------------------------------
# 5. Year filtering — trades in a different year are excluded
# ---------------------------------------------------------------------------


def test_year_statistics_excludes_other_years() -> None:
  """
  Trade A is in 2023, Trade B is in 2024. Querying 2024 must only see Trade B.

  Trade A (2023, +3R winner):
    Long, Buy 100.0, stop=90.0, Sell 130.0 → perf_r = +3.0

  Trade B (2024, -1R loser):
    Long, Buy 100.0, stop=90.0, Sell 90.0 → perf_r = -1.0

  Stats for 2024 only:
    total_trades = 1, winning = 0, losing = 1, breakeven = 0
    total_pnl   = -1.0, avg_pnl = -1.0, win_rate = 0.0
    expectancy  = round(0 - 1*1.0, 2) = -1.0
    profit_factor = 0.0 (no wins, losses > 0 → 0/1.0)
  """
  with TestClient(app) as client:
    asset_id = _create_asset(client)

    # Trade A — year 2023
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2023-09-01"},
          {"type": "Sell", "price": 130.0, "quantity": 1.0, "date": "2023-09-02"},
        ],
      },
    )

    # Trade B — year 2024
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-09-01"},
          {"type": "Sell", "price": 90.0, "quantity": 1.0, "date": "2024-09-02"},
        ],
      },
    )

    resp_2024 = client.get("/api/trades/statistics/2024")
    resp_2023 = client.get("/api/trades/statistics/2023")

  # 2024 — only Trade B
  assert resp_2024.status_code == 200
  d24 = resp_2024.json()["data"]
  assert d24["total_trades"] == 1
  assert d24["winning_trades"] == 0
  assert d24["losing_trades"] == 1
  assert d24["total_pnl"] == pytest.approx(-1.0)
  assert d24["win_rate"] == pytest.approx(0.0)
  assert d24["profit_factor"] == pytest.approx(0.0)

  # 2023 — only Trade A
  assert resp_2023.status_code == 200
  d23 = resp_2023.json()["data"]
  assert d23["total_trades"] == 1
  assert d23["winning_trades"] == 1
  assert d23["losing_trades"] == 0
  assert d23["total_pnl"] == pytest.approx(3.0)
  assert d23["win_rate"] == pytest.approx(100.0)


# ---------------------------------------------------------------------------
# 6. Response envelope shape — error is None, data has all 9 keys
# ---------------------------------------------------------------------------


def test_year_statistics_response_envelope_shape() -> None:
  """The response must follow { data: <object with 9 keys>, error: null }."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 90.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-11-01"},
          {"type": "Sell", "price": 110.0, "quantity": 1.0, "date": "2024-11-02"},
        ],
      },
    )
    response = client.get("/api/trades/statistics/2024")

  assert response.status_code == 200
  body = response.json()

  # Envelope checks
  assert "data" in body
  assert "error" in body
  assert body["error"] is None
  assert isinstance(body["data"], dict)

  # All 9 expected keys present
  expected_keys = {
    "total_trades",
    "winning_trades",
    "losing_trades",
    "breakeven_trades",
    "total_pnl",
    "avg_pnl",
    "win_rate",
    "expectancy",
    "profit_factor",
  }
  assert set(body["data"].keys()) == expected_keys
