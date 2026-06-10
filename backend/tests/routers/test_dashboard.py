from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app

# ---------------------------------------------------------------------------
# Shared helpers (self-contained — no cross-file imports)
# ---------------------------------------------------------------------------


def _create_asset(
  client: TestClient,
  name: str = "EURUSD",
  category: str = "Forex",
  currency: str = "USD",
) -> int:
  resp = client.post(
    "/api/assets", json={"name": name, "category": category, "currency": currency}
  )
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _winner(
  client: TestClient, asset_id: int, date: str, reward_price: float, **overrides: object
) -> None:
  """Create a Long trade: Buy 100 / stop 90 / Sell reward_price → perf_r = (price-100)/10."""
  payload: dict = {
    "asset_id": asset_id,
    "stop_loss": 90.0,
    "activities": [
      {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": date},
      {"type": "Sell", "price": reward_price, "quantity": 1.0, "date": date},
    ],
  }
  payload.update(overrides)
  resp = client.post("/api/trades", json=payload)
  assert resp.status_code == 201, resp.text


# ---------------------------------------------------------------------------
# 1. Empty state — no trades
# ---------------------------------------------------------------------------


def test_dashboard_empty_state() -> None:
  """No trades → zeroed stats, null best/worst, and empty arrays."""
  with TestClient(app) as client:
    response = client.get("/api/dashboard?period=all")

  assert response.status_code == 200, response.text
  body = response.json()
  assert body["error"] is None
  data = body["data"]

  stats = data["stats"]
  assert stats["total_trades"] == 0
  assert stats["win_rate"] == pytest.approx(0.0)
  assert stats["avg_r"] == pytest.approx(0.0)
  assert stats["profit_factor"] == pytest.approx(0.0)
  assert stats["best_r"] is None
  assert stats["worst_r"] is None
  assert stats["total_r"] == pytest.approx(0.0)
  assert stats["total_pct"] == pytest.approx(0.0)

  assert data["monthly"] == []
  assert data["equity"] == []
  assert data["recent_trades"] == []


# ---------------------------------------------------------------------------
# 2. Mixed trades — stats, open and missed-opportunity exclusions
# ---------------------------------------------------------------------------


def test_dashboard_stats_mixed_trades() -> None:
  """
  Four counted trades plus exclusions:
    +2R, +1R, -1R winners/loser → scored
    one open trade (null perf_r) → excluded from stats
    one missed-opportunity winner → excluded from stats

  perfs = [+2, +1, -1], n = 3
    total_trades = 3
    win_rate = round(2/3*100, 2) = 66.67
    avg_r = round(2/3, 2) = 0.67
    profit_factor = round(3/1, 2) = 3.0
    best_r = 2.0, worst_r = -1.0
    total_r = 2.0
    total_pct = 2.0 (risk_per_trade null → 1.0)
  """
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _winner(client, asset_id, "2024-01-10", 120.0)  # +2R
    _winner(client, asset_id, "2024-02-10", 110.0)  # +1R
    _winner(client, asset_id, "2024-03-10", 90.0)   # -1R (Sell at stop)

    # Open trade — no exit, null perf_r.
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-04-01"},
        ],
      },
    )
    # Missed-opportunity winner — must not count in stats.
    _winner(client, asset_id, "2024-05-10", 130.0, missed_opportunity=True)

    response = client.get("/api/dashboard?period=all")

  assert response.status_code == 200, response.text
  stats = response.json()["data"]["stats"]
  assert stats["total_trades"] == 3
  assert stats["win_rate"] == pytest.approx(66.67)
  assert stats["avg_r"] == pytest.approx(0.67)
  assert stats["profit_factor"] == pytest.approx(3.0)
  assert stats["best_r"] == pytest.approx(2.0)
  assert stats["worst_r"] == pytest.approx(-1.0)
  assert stats["total_r"] == pytest.approx(2.0)
  assert stats["total_pct"] == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# 3. profit_factor edge cases
# ---------------------------------------------------------------------------


def test_dashboard_profit_factor_no_losses() -> None:
  """Only winners → profit_factor sentinel 999.0."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _winner(client, asset_id, "2024-01-10", 120.0)  # +2R
    _winner(client, asset_id, "2024-02-10", 115.0)  # +1.5R
    response = client.get("/api/dashboard?period=all")

  stats = response.json()["data"]["stats"]
  assert stats["profit_factor"] == pytest.approx(999.0)


def test_dashboard_profit_factor_no_wins() -> None:
  """Only losers → profit_factor 0.0."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _winner(client, asset_id, "2024-01-10", 80.0)  # -2R
    _winner(client, asset_id, "2024-02-10", 95.0)  # -0.5R
    response = client.get("/api/dashboard?period=all")

  stats = response.json()["data"]["stats"]
  assert stats["profit_factor"] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# 4. Period filtering — YTD vs ALL
# ---------------------------------------------------------------------------


def test_dashboard_period_filtering_ytd_vs_all() -> None:
  """YTD only sees current-year trades; ALL sees every year."""
  current_year = datetime.now(timezone.utc).year
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _winner(client, asset_id, f"{current_year}-01-15", 120.0)  # +2R, this year
    _winner(client, asset_id, f"{current_year - 2}-01-15", 110.0)  # +1R, two years ago

    ytd = client.get("/api/dashboard?period=ytd").json()["data"]
    all_ = client.get("/api/dashboard?period=all").json()["data"]

  assert ytd["stats"]["total_trades"] == 1
  assert ytd["stats"]["total_r"] == pytest.approx(2.0)
  assert all_["stats"]["total_trades"] == 2
  assert all_["stats"]["total_r"] == pytest.approx(3.0)


# ---------------------------------------------------------------------------
# 5. Account-type filtering — live vs test vs all
# ---------------------------------------------------------------------------


def test_dashboard_account_type_filtering() -> None:
  """Default `live` excludes test trades; `test` isolates them; `all` merges."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _winner(client, asset_id, "2024-01-10", 120.0, account_type="live")  # +2R live
    _winner(client, asset_id, "2024-02-10", 110.0, account_type="test")  # +1R test

    live = client.get("/api/dashboard?period=all&account_type=live").json()["data"]
    test = client.get("/api/dashboard?period=all&account_type=test").json()["data"]
    merged = client.get("/api/dashboard?period=all&account_type=all").json()["data"]

  assert live["stats"]["total_trades"] == 1
  assert live["stats"]["total_r"] == pytest.approx(2.0)
  assert test["stats"]["total_trades"] == 1
  assert test["stats"]["total_r"] == pytest.approx(1.0)
  assert merged["stats"]["total_trades"] == 2
  assert merged["stats"]["total_r"] == pytest.approx(3.0)


# ---------------------------------------------------------------------------
# 6. Equity curve — chronological order and running cumulative
# ---------------------------------------------------------------------------


def test_dashboard_equity_curve_ordering() -> None:
  """Equity points are date-ascending with a correct running cumulative."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    # Insert out of chronological order to prove server-side sorting.
    _winner(client, asset_id, "2024-03-10", 90.0)   # -1R
    _winner(client, asset_id, "2024-01-10", 120.0)  # +2R
    _winner(client, asset_id, "2024-02-10", 110.0)  # +1R

    equity = client.get("/api/dashboard?period=all").json()["data"]["equity"]

  dates = [p["date"] for p in equity]
  assert dates == ["2024-01-10", "2024-02-10", "2024-03-10"]
  # Running cumulative R: +2, then +3, then +2.
  assert [p["cumulative_r"] for p in equity] == pytest.approx([2.0, 3.0, 2.0])
  assert [p["cumulative_pct"] for p in equity] == pytest.approx([2.0, 3.0, 2.0])


# ---------------------------------------------------------------------------
# 7. Monthly aggregation — populated and zero-filled months
# ---------------------------------------------------------------------------


def test_dashboard_monthly_aggregation() -> None:
  """Months with trades aggregate; gaps between them are zero-filled."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _winner(client, asset_id, "2024-01-10", 120.0)  # +2R Jan
    _winner(client, asset_id, "2024-01-20", 110.0)  # +1R Jan
    _winner(client, asset_id, "2024-03-10", 90.0)   # -1R Mar (Feb has none)

    monthly = client.get("/api/dashboard?period=all").json()["data"]["monthly"]

  by_key = {(m["year"], m["month"]): m for m in monthly}
  jan = by_key[(2024, 1)]
  assert jan["month_label"] == "Jan"
  assert jan["value_r"] == pytest.approx(3.0)
  assert jan["trade_count"] == 2

  feb = by_key[(2024, 2)]
  assert feb["month_label"] == "Feb"
  assert feb["value_r"] == pytest.approx(0.0)
  assert feb["trade_count"] == 0

  mar = by_key[(2024, 3)]
  assert mar["value_r"] == pytest.approx(-1.0)
  assert mar["trade_count"] == 1


# ---------------------------------------------------------------------------
# 8. Recent trades — last 10, independent of period
# ---------------------------------------------------------------------------


def test_dashboard_recent_trades_last_ten_ignores_period() -> None:
  """Recent list caps at 10 and ignores the period filter (here a non-current year)."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    for day in range(1, 13):  # 12 closed trades in 2020
      _winner(client, asset_id, f"2020-01-{day:02d}", 110.0)

    # YTD would exclude every 2020 trade from stats, but recent_trades must not.
    data = client.get("/api/dashboard?period=ytd").json()["data"]

  assert data["stats"]["total_trades"] == 0
  recent = data["recent_trades"]
  assert len(recent) == 10
  # Sorted by trade_date DESC → the latest day first.
  assert recent[0]["trade_date"] == "2020-01-12"
  assert recent[-1]["trade_date"] == "2020-01-03"

  first = recent[0]
  assert first["asset_name"] == "EURUSD"
  assert first["asset_currency"] == "USD"
  assert first["direction"] == "Long"
  assert first["status"] == "Closed"
  assert first["performance_r"] == pytest.approx(1.0)
  assert first["performance_pct"] == pytest.approx(1.0)


def test_dashboard_recent_trades_excludes_missed_opportunity() -> None:
  """A missed-opportunity trade exists in the DB but never appears in recent_trades."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _winner(client, asset_id, "2024-01-10", 120.0, missed_opportunity=True)

    # The trade is persisted...
    trades = client.get("/api/trades").json()["data"]
    assert len(trades) == 1
    assert trades[0]["missed_opportunity"] is True

    # ...but excluded from the dashboard.
    data = client.get("/api/dashboard?period=all").json()["data"]

  assert data["recent_trades"] == []
  assert data["stats"]["total_trades"] == 0


# ---------------------------------------------------------------------------
# 9. Response envelope shape
# ---------------------------------------------------------------------------


def test_dashboard_response_envelope_shape() -> None:
  """The response follows { data: {...}, error: null } with the documented keys."""
  with TestClient(app) as client:
    response = client.get("/api/dashboard")

  assert response.status_code == 200
  body = response.json()
  assert "data" in body and "error" in body
  assert body["error"] is None

  data = body["data"]
  assert set(data.keys()) == {"stats", "monthly", "equity", "recent_trades"}
  assert set(data["stats"].keys()) == {
    "total_trades",
    "win_rate",
    "avg_r",
    "profit_factor",
    "best_r",
    "worst_r",
    "total_r",
    "total_pct",
  }


# ---------------------------------------------------------------------------
# 10. Invalid query parameters are rejected
# ---------------------------------------------------------------------------


def test_dashboard_invalid_period_rejected() -> None:
  """An unsupported period value fails validation."""
  with TestClient(app) as client:
    response = client.get("/api/dashboard?period=decade")

  assert response.status_code == 422
  assert response.json()["error"] is not None
