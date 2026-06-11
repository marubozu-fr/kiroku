"""Tests for the Monte Carlo projection engine and GET /api/projections endpoint."""
import os
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.projections_service import (  # noqa: E402
  _percentile,
  _streaks,
  compute_actual_months,
  compute_estimated_trades,
  compute_stats,
  run_simulation,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _trade(
  id: int,
  performance_r: float,
  trade_date: str = "2025-06-15",
  missed_opportunity: int = 0,
  asset_name: str = "EURUSD",
) -> dict:
  return {
    "id": id,
    "performance_r": performance_r,
    "trade_date": trade_date,
    "missed_opportunity": missed_opportunity,
    "asset_name": asset_name,
    "asset_id": 1,
    "asset_currency": "USD",
    "account_type": "live",
    "status": "Closed",
  }


def _make_pool(r_values: list[float], base_date: str = "2025-06-15") -> list[dict]:
  """Build a minimal pool list from a list of R-values."""
  return [_trade(i + 1, r, trade_date=base_date) for i, r in enumerate(r_values)]


def _insert_trades_in_db(trades: list[dict]) -> None:
  """Insert trades (and a single asset) directly via raw sqlite3 into the test DB."""
  db_path = os.environ["KIROKU_DB_PATH"]
  conn = sqlite3.connect(db_path)
  # Insert a shared asset row.
  conn.execute(
    "INSERT OR IGNORE INTO assets (id, name, category) VALUES (1, 'EURUSD', 'Forex')"
  )
  for t in trades:
    conn.execute(
      """
      INSERT INTO trades
        (id, asset_id, account_type, status, missed_opportunity,
         performance_r, trade_date, created_at, updated_at)
      VALUES
        (:id, :asset_id, :account_type, :status, :missed,
         :perf, :date, '2025-01-01', '2025-01-01')
      """,
      {
        "id": t["id"],
        "asset_id": t.get("asset_id", 1),
        "account_type": t.get("account_type", "live"),
        "status": t.get("status", "Closed"),
        "missed": t.get("missed_opportunity", 0),
        "perf": t.get("performance_r"),
        "date": t["trade_date"],
      },
    )
  conn.commit()
  conn.close()


def _default_estimated_trades() -> dict[int, int]:
  return {m: 5 for m in range(1, 13)}


# ---------------------------------------------------------------------------
# 1. compute_stats — unit tests
# ---------------------------------------------------------------------------

class TestComputeStats:
  def test_basic_fields_present(self) -> None:
    pool = _make_pool([1.0, -1.0, 2.0, -0.5, 1.5, 0.5, -1.0, 0.8, 1.2, 0.3])
    stats = compute_stats(pool)
    for key in (
      "expectancy", "win_rate", "std_deviation", "skewness", "kurtosis",
      "total_trades", "best_trade", "worst_trade",
      "max_winning_streak", "max_losing_streak",
    ):
      assert key in stats, f"missing key: {key}"

  def test_expectancy_and_win_rate(self) -> None:
    # 7 positive, 3 negative in a 10-trade pool.
    r = [1.0] * 7 + [-1.0] * 3
    pool = _make_pool(r)
    stats = compute_stats(pool)
    assert stats["expectancy"] == pytest.approx(0.4, abs=1e-9)
    assert stats["win_rate"] == pytest.approx(70.0, abs=1e-9)

  def test_best_worst(self) -> None:
    pool = _make_pool([1.0, 2.0, -3.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
    stats = compute_stats(pool)
    assert stats["best_trade"] == pytest.approx(2.0)
    assert stats["worst_trade"] == pytest.approx(-3.0)

  def test_skewness_symmetric_near_zero(self) -> None:
    # Symmetric distribution: skewness should be close to 0.
    r = [-2.0, -1.0, 0.0, 1.0, 2.0] * 2  # 10 trades, symmetric
    pool = _make_pool(r)
    stats = compute_stats(pool)
    assert abs(stats["skewness"]) < 0.1, f"skewness={stats['skewness']} not near 0"

  def test_kurtosis_raw_not_excess(self) -> None:
    # For a normal-ish dataset the raw Pearson kurtosis should be around 3, not ~0.
    # Use a reasonably sized symmetric dataset.
    import random as rng
    rng.seed(42)
    vals = [rng.gauss(0, 1) for _ in range(200)]
    pool = [_trade(i + 1, v, trade_date="2025-03-01") for i, v in enumerate(vals)]
    stats = compute_stats(pool)
    # Raw kurtosis of a normal distribution is 3; allow wide tolerance for finite sample.
    assert 1.5 < stats["kurtosis"] < 5.0, f"kurtosis={stats['kurtosis']} not near 3"

  def test_std_zero_returns_zero_skew_kurt(self) -> None:
    # All same value → std=0 → skewness/kurtosis guarded to 0.
    pool = [_trade(i + 1, 1.0, trade_date="2025-01-01") for i in range(10)]
    stats = compute_stats(pool)
    assert stats["skewness"] == 0.0
    assert stats["kurtosis"] == 0.0

  def test_streak_counting(self) -> None:
    # W W W L L → max_winning_streak=3, max_losing_streak=2
    r = [1.0, 1.0, 1.0, -1.0, -1.0] * 2  # 10 trades
    pool = [
      _trade(i + 1, r[i], trade_date=f"2025-0{(i // 5) + 1}-{i + 1:02d}")
      for i in range(10)
    ]
    stats = compute_stats(pool)
    assert stats["max_winning_streak"] >= 3
    assert stats["max_losing_streak"] >= 2


# ---------------------------------------------------------------------------
# 2. compute_actual_months — unit tests
# ---------------------------------------------------------------------------

class TestComputeActualMonths:
  def test_zero_fill_for_empty_months(self) -> None:
    pool = [_trade(1, 2.0, trade_date="2026-01-15")]
    months, ytd = compute_actual_months(pool, current_year=2026, current_month=3)
    assert len(months) == 3
    assert months[0]["month"] == 1
    assert months[0]["cumulative_r"] == pytest.approx(2.0)
    assert months[1]["month"] == 2
    assert months[1]["month_r"] == pytest.approx(0.0)
    assert months[2]["month"] == 3
    assert months[2]["month_r"] == pytest.approx(0.0)

  def test_ytd_matches_last_cumulative(self) -> None:
    pool = [
      _trade(1, 3.0, trade_date="2026-02-01"),
      _trade(2, -1.0, trade_date="2026-03-10"),
    ]
    months, ytd = compute_actual_months(pool, current_year=2026, current_month=3)
    assert ytd == pytest.approx(2.0)
    assert months[-1]["cumulative_r"] == pytest.approx(2.0)

  def test_excludes_other_years(self) -> None:
    pool = [
      _trade(1, 5.0, trade_date="2025-01-01"),
      _trade(2, 2.0, trade_date="2026-01-01"),
    ]
    months, ytd = compute_actual_months(pool, current_year=2026, current_month=1)
    assert months[0]["month_r"] == pytest.approx(2.0)

  def test_month_labels(self) -> None:
    pool = _make_pool([1.0] * 10, base_date="2026-04-01")
    months, _ = compute_actual_months(pool, current_year=2026, current_month=4)
    labels = [m["label"] for m in months]
    assert labels == ["Jan", "Feb", "Mar", "Apr"]

  def test_trades_count(self) -> None:
    pool = [
      _trade(1, 1.0, trade_date="2026-06-01"),
      _trade(2, 2.0, trade_date="2026-06-15"),
    ]
    months, _ = compute_actual_months(pool, current_year=2026, current_month=6)
    june = months[5]
    assert june["trades_count"] == 2


# ---------------------------------------------------------------------------
# 3. compute_estimated_trades — unit tests
# ---------------------------------------------------------------------------

class TestComputeEstimatedTrades:
  def test_returns_all_12_months(self) -> None:
    pool = _make_pool([1.0] * 10)
    freq = compute_estimated_trades(pool)
    assert set(freq.keys()) == set(range(1, 13))

  def test_month_with_trades_uses_historical_freq(self) -> None:
    # 4 trades in June across 2 years → freq[6] = round(4/2) = 2.
    pool = (
      [_trade(i + 1, 1.0, trade_date=f"202{i % 2 + 4}-06-{i + 1:02d}") for i in range(4)]
      + [_trade(i + 5, 1.0, trade_date=f"2024-01-{i + 1:02d}") for i in range(6)]
    )
    freq = compute_estimated_trades(pool)
    assert freq[6] >= 1

  def test_fallback_used_for_empty_months(self) -> None:
    # All trades in January only; all other months should use fallback.
    pool = [_trade(i + 1, 1.0, trade_date=f"2025-01-{i + 1:02d}") for i in range(10)]
    freq = compute_estimated_trades(pool)
    # Months 2-12 have no trades → fallback.
    fallback = max(round(10 / 1 / 12), 1)
    for m in range(2, 13):
      assert freq[m] == fallback

  def test_minimum_one(self) -> None:
    pool = _make_pool([1.0] * 10)
    freq = compute_estimated_trades(pool)
    for m in range(1, 13):
      assert freq[m] >= 1


# ---------------------------------------------------------------------------
# 4. _percentile — unit tests
# ---------------------------------------------------------------------------

class TestPercentile:
  def test_p0_is_min(self) -> None:
    assert _percentile([1.0, 2.0, 3.0], 0) == pytest.approx(1.0)

  def test_p100_is_max(self) -> None:
    assert _percentile([1.0, 2.0, 3.0], 100) == pytest.approx(3.0)

  def test_p50_on_even_list(self) -> None:
    # Linear interpolation between 2 and 3 at rank 1.5.
    assert _percentile([1.0, 2.0, 3.0, 4.0], 50) == pytest.approx(2.5)

  def test_empty_list(self) -> None:
    assert _percentile([], 50) == pytest.approx(0.0)

  def test_single_element(self) -> None:
    assert _percentile([7.0], 50) == pytest.approx(7.0)


# ---------------------------------------------------------------------------
# 5. run_simulation — unit tests
# ---------------------------------------------------------------------------

class TestRunSimulation:
  def _all_winner_r(self, n: int = 20) -> list[float]:
    return [1.0] * n

  def _all_loser_r(self, n: int = 20) -> list[float]:
    return [-1.0] * n

  def test_reproducibility_with_seed(self) -> None:
    r_values = [1.0, -0.5, 2.0, -1.0, 0.3] * 4
    est = _default_estimated_trades()
    proj1, ruin1, dd1, finals1 = run_simulation(r_values, est, 6, 0.0, 500, seed=42)
    proj2, ruin2, dd2, finals2 = run_simulation(r_values, est, 6, 0.0, 500, seed=42)
    assert proj1 == proj2
    assert ruin1 == ruin2
    assert dd1 == dd2
    assert finals1 == finals2

  def test_different_seeds_differ(self) -> None:
    r_values = [1.0, -0.5, 2.0, -1.0, 0.3] * 4
    est = _default_estimated_trades()
    proj1, _, _, _ = run_simulation(r_values, est, 6, 0.0, 500, seed=1)
    proj2, _, _, _ = run_simulation(r_values, est, 6, 0.0, 500, seed=2)
    assert proj1 != proj2

  def test_schema_of_projected_months(self) -> None:
    r_values = [1.0, -1.0] * 10
    est = _default_estimated_trades()
    proj, _, _, _ = run_simulation(r_values, est, 6, 0.0, 200, seed=0)
    # current_month=6 → months 7..12 projected.
    assert [p["month"] for p in proj] == list(range(7, 13))
    for p in proj:
      assert p["p10"] <= p["p25"] <= p["p50"] <= p["p75"] <= p["p90"]
      assert p["estimated_trades"] == 5

  def test_all_winners_ruin_near_zero(self) -> None:
    r_values = self._all_winner_r()
    est = _default_estimated_trades()
    _, ruin, _, _ = run_simulation(r_values, est, 6, 0.0, 1000, seed=99)
    assert ruin == pytest.approx(0.0)

  def test_all_losers_ruin_near_one(self) -> None:
    r_values = self._all_loser_r()
    est = _default_estimated_trades()
    _, ruin, _, _ = run_simulation(r_values, est, 6, 0.0, 1000, seed=99)
    assert ruin > 0.9

  def test_max_drawdown_median_le_zero(self) -> None:
    r_values = [0.5, -0.5] * 10
    est = _default_estimated_trades()
    _, _, dd, _ = run_simulation(r_values, est, 3, 0.0, 500, seed=0)
    assert dd <= 0.0

  def test_no_projected_months_when_december(self) -> None:
    r_values = [1.0, -1.0] * 10
    est = _default_estimated_trades()
    proj, ruin, dd, finals = run_simulation(r_values, est, 12, 5.0, 200, seed=0)
    assert proj == []
    # Trivially: final = actual_ytd_r = 5.0 > 0 → ruin = 0.
    assert ruin == pytest.approx(0.0)
    assert dd <= 0.0
    assert finals == [5.0] * 200

  def test_monotonic_percentiles_each_month(self) -> None:
    r_values = list(range(-5, 6)) * 2  # mixed
    est = _default_estimated_trades()
    proj, _, _, _ = run_simulation(r_values, est, 1, 0.0, 1000, seed=7)
    for p in proj:
      assert p["p10"] <= p["p25"] <= p["p50"] <= p["p75"] <= p["p90"], (
        f"month {p['month']}: percentiles not monotonic"
      )


# ---------------------------------------------------------------------------
# 6. Goal probability — unit tests
# ---------------------------------------------------------------------------

class TestGoalProbability:
  def test_all_winners_trivial_goal_near_one(self) -> None:
    from app.services.projections_service import goal_probability
    r_values = [2.0] * 20
    est = _default_estimated_trades()
    # Starting at 0; 6 projected months × 5 trades × 2.0 = +60 expected.
    _, _, _, finals = run_simulation(r_values, est, 6, 0.0, 1000, seed=0)
    assert goal_probability(finals, goal_r=1.0) > 0.9

  def test_all_losers_unreachable_goal_near_zero(self) -> None:
    from app.services.projections_service import goal_probability
    r_values = [-2.0] * 20
    est = _default_estimated_trades()
    _, _, _, finals = run_simulation(r_values, est, 6, 0.0, 1000, seed=0)
    assert goal_probability(finals, goal_r=10.0) < 0.1

  def test_probability_in_range(self) -> None:
    from app.services.projections_service import goal_probability
    r_values = [1.0, -0.5] * 10
    est = _default_estimated_trades()
    _, _, _, finals = run_simulation(r_values, est, 6, 0.0, 500, seed=42)
    assert 0.0 <= goal_probability(finals, goal_r=5.0) <= 1.0

  def test_consistent_with_simulation_finals(self) -> None:
    # Goal probability derives from the same finals as the percentile bands:
    # P(final >= P50) must be ~0.5, since the median splits the distribution.
    from app.services.projections_service import _percentile, goal_probability
    r_values = [1.0, -0.5, 2.0, -1.0, 0.3] * 4
    est = _default_estimated_trades()
    _, _, _, finals = run_simulation(r_values, est, 6, 0.0, 1000, seed=11)
    median = _percentile(sorted(finals), 50)
    assert goal_probability(finals, goal_r=median) == pytest.approx(0.5, abs=0.05)


# ---------------------------------------------------------------------------
# 7. _streaks — unit test (shared with analytics; tiny smoke-test)
# ---------------------------------------------------------------------------

class TestStreaks:
  def test_simple_sequence(self) -> None:
    trades = [
      _trade(1, 1.0, trade_date="2025-01-01"),
      _trade(2, 1.0, trade_date="2025-01-02"),
      _trade(3, 1.0, trade_date="2025-01-03"),
      _trade(4, -1.0, trade_date="2025-01-04"),
      _trade(5, -1.0, trade_date="2025-01-05"),
    ]
    win, loss = _streaks(trades)
    assert win == 3
    assert loss == 2


# ---------------------------------------------------------------------------
# 8. Endpoint tests — via TestClient
# ---------------------------------------------------------------------------

def _make_db_trades(n: int = 15, start_year: int = 2025) -> list[dict]:
  """Generate n alternating winner/loser trades spread across months."""
  trades = []
  for i in range(n):
    month = (i % 12) + 1
    perf = 1.0 if i % 2 == 0 else -0.5
    trades.append({
      "id": i + 1,
      "asset_id": 1,
      "account_type": "live",
      "status": "Closed",
      "missed_opportunity": 0,
      "performance_r": perf,
      "trade_date": f"{start_year}-{month:02d}-{(i % 28) + 1:02d}",
    })
  return trades


class TestProjectionsEndpoint:
  def test_basic_projection_schema(self) -> None:
    """15 trades, no filters → valid schema, projected months cover current_month+1..12."""
    _insert_trades_in_db(_make_db_trades(15))
    with TestClient(app) as client:
      resp = client.get("/api/projections?simulations=200")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["error"] is None
    data = body["data"]

    # Required top-level keys.
    for key in ("actual_months", "projected_months", "stats", "risk", "filters_applied"):
      assert key in data, f"missing key: {key}"

    # Stats fields.
    stats = data["stats"]
    for k in ("expectancy", "win_rate", "std_deviation", "skewness", "kurtosis",
              "total_trades", "best_trade", "worst_trade",
              "max_winning_streak", "max_losing_streak"):
      assert k in stats, f"stats missing key: {k}"

    # Projected months monotonic.
    for pm in data["projected_months"]:
      assert pm["p10"] <= pm["p25"] <= pm["p50"] <= pm["p75"] <= pm["p90"], (
        f"month {pm['month']}: percentiles not monotonic"
      )

    # Risk always present.
    risk = data["risk"]
    assert "ruin_probability" in risk
    assert "max_drawdown_median" in risk
    assert risk["max_drawdown_median"] <= 0.0

  def test_insufficient_data_returns_400(self) -> None:
    """Fewer than 10 scored trades → 400 with error message."""
    _insert_trades_in_db(_make_db_trades(5))
    with TestClient(app) as client:
      resp = client.get("/api/projections")
    assert resp.status_code == 400, resp.text
    body = resp.json()
    assert body["data"] is None
    assert "Insufficient data" in body["error"]

  def test_goal_present_when_provided(self) -> None:
    """goal_r param → goal object in response."""
    _insert_trades_in_db(_make_db_trades(15))
    with TestClient(app) as client:
      resp = client.get("/api/projections?goal_r=10.0&simulations=200")
    assert resp.status_code == 200, resp.text
    goal = resp.json()["data"]["goal"]
    assert goal is not None
    assert goal["target_r"] == pytest.approx(10.0)
    assert 0.0 <= goal["probability"] <= 1.0

  def test_goal_absent_when_not_provided(self) -> None:
    """No goal_r param → goal is null."""
    _insert_trades_in_db(_make_db_trades(15))
    with TestClient(app) as client:
      resp = client.get("/api/projections?simulations=200")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["goal"] is None

  def test_filters_applied_reflected(self) -> None:
    """filters_applied mirrors the query parameters."""
    _insert_trades_in_db(_make_db_trades(15))
    with TestClient(app) as client:
      resp = client.get(
        "/api/projections?start_date=2025-01-01&assets=EURUSD&simulations=200"
      )
    assert resp.status_code == 200, resp.text
    fa = resp.json()["data"]["filters_applied"]
    assert fa["start_date"] == "2025-01-01"
    assert fa["assets"] == ["EURUSD"]

  def test_asset_filter_reduces_pool(self) -> None:
    """An asset filter for a name not in DB → too few trades → 400."""
    _insert_trades_in_db(_make_db_trades(15))
    with TestClient(app) as client:
      resp = client.get("/api/projections?assets=BTCUSD&simulations=200")
    # BTCUSD not in DB → pool < 10 → 400.
    assert resp.status_code == 400, resp.text

  def test_start_date_filter_reduces_pool(self) -> None:
    """start_date that excludes most trades → fewer than 10 → 400."""
    _insert_trades_in_db(_make_db_trades(15))
    with TestClient(app) as client:
      # Far-future start_date excludes everything.
      resp = client.get("/api/projections?start_date=2099-01-01&simulations=200")
    assert resp.status_code == 400, resp.text

  def test_simulations_clamped(self) -> None:
    """simulations=50 (below min) should be clamped to 100 without error."""
    _insert_trades_in_db(_make_db_trades(15))
    with TestClient(app) as client:
      resp = client.get("/api/projections?simulations=50")
    # Should succeed (pool is large enough) regardless of the clamp.
    assert resp.status_code == 200, resp.text
