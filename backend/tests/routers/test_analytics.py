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


def _create_tag(client: TestClient, name: str) -> int:
  resp = client.post("/api/tags", json={"name": name})
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _create_emotion(client: TestClient, name: str) -> int:
  resp = client.post(
    "/api/emotions",
    json={"name": name, "severity": "Good", "category": "Emotional State"},
  )
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _trade(
  client: TestClient,
  asset_id: int,
  date: str,
  exit_price: float,
  **overrides: object,
) -> int:
  """Create a Long trade: Buy 100 / stop 90 / Sell exit_price → perf_r = (price-100)/10.

  `date` is used for both activities by default; pass `exit_date` to span time.
  """
  exit_date = overrides.pop("exit_date", date)
  payload: dict = {
    "asset_id": asset_id,
    "stop_loss": 90.0,
    "activities": [
      {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": date},
      {"type": "Sell", "price": exit_price, "quantity": 1.0, "date": exit_date},
    ],
  }
  payload.update(overrides)
  resp = client.post("/api/trades", json=payload)
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _open_trade(client: TestClient, asset_id: int, date: str, **overrides: object) -> int:
  """Create an Open trade (single Buy, no exit) → null performance_r."""
  payload: dict = {
    "asset_id": asset_id,
    "activities": [{"type": "Buy", "price": 100.0, "quantity": 1.0, "date": date}],
  }
  payload.update(overrides)
  resp = client.post("/api/trades", json=payload)
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _stats(client: TestClient, query: str = "") -> dict:
  resp = client.get(f"/api/analytics/statistics{query}")
  assert resp.status_code == 200, resp.text
  body = resp.json()
  assert body["error"] is None
  return body["data"]


# ---------------------------------------------------------------------------
# 1. Empty dataset
# ---------------------------------------------------------------------------


def test_statistics_no_trades() -> None:
  """No trades → zeroed stats, null profit_factor/best/worst, empty filters."""
  with TestClient(app) as client:
    data = _stats(client)

  s = data["statistics"]
  assert s["total_trades"] == 0
  assert s["winning_trades"] == 0
  assert s["losing_trades"] == 0
  assert s["breakeven_trades"] == 0
  assert s["total_pnl"] == pytest.approx(0.0)
  assert s["avg_pnl"] == pytest.approx(0.0)
  assert s["win_rate"] == pytest.approx(0.0)
  assert s["avg_win"] == pytest.approx(0.0)
  assert s["avg_loss"] == pytest.approx(0.0)
  assert s["expectancy"] == pytest.approx(0.0)
  assert s["profit_factor"] is None
  assert s["avg_duration_hours"] == pytest.approx(0.0)
  assert s["winning_streak"] == 0
  assert s["losing_streak"] == 0
  assert s["best_trade"] is None
  assert s["worst_trade"] is None

  f = data["available_filters"]
  assert f["assets"] == []
  assert f["directions"] == []
  assert f["timeframes"] == []
  assert f["tags"] == []
  assert f["emotions"] == []
  assert f["types"] == []
  assert f["date_range"] == {"min": None, "max": None}


# ---------------------------------------------------------------------------
# 2. Single trade
# ---------------------------------------------------------------------------


def test_statistics_single_winning_trade() -> None:
  """One +2R winner → derived stats, profit_factor null (no losses)."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)  # +2R
    data = _stats(client)

  s = data["statistics"]
  assert s["total_trades"] == 1
  assert s["winning_trades"] == 1
  assert s["losing_trades"] == 0
  assert s["total_pnl"] == pytest.approx(2.0)
  assert s["avg_pnl"] == pytest.approx(2.0)
  assert s["win_rate"] == pytest.approx(100.0)
  assert s["avg_win"] == pytest.approx(2.0)
  assert s["avg_loss"] == pytest.approx(0.0)
  assert s["expectancy"] == pytest.approx(2.0)
  assert s["profit_factor"] is None  # no losses
  assert s["winning_streak"] == 1
  assert s["losing_streak"] == 0
  assert s["best_trade"] == pytest.approx(2.0)
  assert s["worst_trade"] == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# 3. Mixed results — full KPI verification + open trade + streaks
# ---------------------------------------------------------------------------


def test_statistics_mixed_results() -> None:
  """
  Five trades by date:
    2024-01: +2R win
    2024-02: +1R win
    2024-03: -1R loss
    2024-04: +3R win
    2024-05: open (null perf_r) — counts in total only

  perfs = [+2, +1, -1, +3], n = 4
    total_trades = 5
    winning = 3, losing = 1, breakeven = 0
    total_pnl = 5.0, avg_pnl = round(5/4, 2) = 1.25
    win_rate = round(3/4*100, 2) = 75.0
    avg_win = (2+1+3)/3 = 2.0, avg_loss = 1.0
    expectancy = round(3/4*2.0 - 1/4*1.0, 2) = round(1.5 - 0.25, 2) = 1.25
    profit_factor = round(6/1, 2) = 6.0
    best = 3.0, worst = -1.0
    winning_streak = 2 (Jan, Feb), losing_streak = 1
  """
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)  # +2R
    _trade(client, asset_id, "2024-02-10", 110.0)  # +1R
    _trade(client, asset_id, "2024-03-10", 90.0)   # -1R
    _trade(client, asset_id, "2024-04-10", 130.0)  # +3R
    _open_trade(client, asset_id, "2024-05-10")    # open
    data = _stats(client)

  s = data["statistics"]
  assert s["total_trades"] == 5
  assert s["winning_trades"] == 3
  assert s["losing_trades"] == 1
  assert s["breakeven_trades"] == 0
  assert s["total_pnl"] == pytest.approx(5.0)
  assert s["avg_pnl"] == pytest.approx(1.25)
  assert s["win_rate"] == pytest.approx(75.0)
  assert s["avg_win"] == pytest.approx(2.0)
  assert s["avg_loss"] == pytest.approx(1.0)
  assert s["expectancy"] == pytest.approx(1.25)
  assert s["profit_factor"] == pytest.approx(6.0)
  assert s["best_trade"] == pytest.approx(3.0)
  assert s["worst_trade"] == pytest.approx(-1.0)
  assert s["winning_streak"] == 2
  assert s["losing_streak"] == 1


# ---------------------------------------------------------------------------
# 4. profit_factor null when there are no losses but multiple winners
# ---------------------------------------------------------------------------


def test_statistics_profit_factor_null_without_losses() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)  # +2R
    _trade(client, asset_id, "2024-02-10", 115.0)  # +1.5R
    data = _stats(client)

  assert data["statistics"]["profit_factor"] is None


# ---------------------------------------------------------------------------
# 5. Missed opportunity toggle
# ---------------------------------------------------------------------------


def test_statistics_excludes_missed_by_default() -> None:
  """A missed-opportunity trade is excluded unless include_missed=true."""
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)  # +2R counted
    _trade(client, asset_id, "2024-02-10", 130.0, missed_opportunity=True)  # +3R excluded

    default = _stats(client)
    included = _stats(client, "?include_missed=true")

  assert default["statistics"]["total_trades"] == 1
  assert default["statistics"]["total_pnl"] == pytest.approx(2.0)
  assert included["statistics"]["total_trades"] == 2
  assert included["statistics"]["total_pnl"] == pytest.approx(5.0)


# ---------------------------------------------------------------------------
# 6. Date range filter
# ---------------------------------------------------------------------------


def test_statistics_date_filters() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)  # +2R
    _trade(client, asset_id, "2024-06-10", 110.0)  # +1R
    _trade(client, asset_id, "2024-12-10", 90.0)   # -1R

    only_june = _stats(client, "?date_from=2024-03-01&date_to=2024-09-01")

  s = only_june["statistics"]
  assert s["total_trades"] == 1
  assert s["total_pnl"] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# 7. Asset / direction / type filters
# ---------------------------------------------------------------------------


def test_statistics_asset_and_type_filters() -> None:
  with TestClient(app) as client:
    a1 = _create_asset(client, name="EURUSD")
    a2 = _create_asset(client, name="GBPUSD")
    _trade(client, a1, "2024-01-10", 120.0, account_type="live")   # +2R
    _trade(client, a2, "2024-02-10", 110.0, account_type="demo")   # +1R

    by_asset = _stats(client, f"?asset_ids={a1}")
    by_type = _stats(client, "?types=Demo")

  assert by_asset["statistics"]["total_trades"] == 1
  assert by_asset["statistics"]["total_pnl"] == pytest.approx(2.0)
  assert by_type["statistics"]["total_trades"] == 1
  assert by_type["statistics"]["total_pnl"] == pytest.approx(1.0)


def test_statistics_direction_filter() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)  # Long (Buy first)
    # Short trade: Sell first then Buy back lower → profit.
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 110.0,
        "activities": [
          {"type": "Sell", "price": 100.0, "quantity": 1.0, "date": "2024-02-10"},
          {"type": "Buy", "price": 90.0, "quantity": 1.0, "date": "2024-02-11"},
        ],
      },
    )

    longs = _stats(client, "?direction=Long")
    shorts = _stats(client, "?direction=Short")

  assert longs["statistics"]["total_trades"] == 1
  assert shorts["statistics"]["total_trades"] == 1


# ---------------------------------------------------------------------------
# 8. Tags AND / OR logic
# ---------------------------------------------------------------------------


def test_statistics_tags_and_or_logic() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    t1 = _create_tag(client, "Breakout")
    t2 = _create_tag(client, "Pullback")

    _trade(client, asset_id, "2024-01-10", 120.0, tag_ids=[t1])        # only t1
    _trade(client, asset_id, "2024-02-10", 110.0, tag_ids=[t1, t2])    # both
    _trade(client, asset_id, "2024-03-10", 130.0, tag_ids=[t2])        # only t2

    and_logic = _stats(client, f"?tag_ids={t1},{t2}&tags_logic=AND")
    or_logic = _stats(client, f"?tag_ids={t1},{t2}&tags_logic=OR")
    default_logic = _stats(client, f"?tag_ids={t1},{t2}")

  assert and_logic["statistics"]["total_trades"] == 1  # only the "both" trade
  assert or_logic["statistics"]["total_trades"] == 3   # any tag
  assert default_logic["statistics"]["total_trades"] == 1  # AND is the default


# ---------------------------------------------------------------------------
# 9. Emotion filter
# ---------------------------------------------------------------------------


def test_statistics_emotion_filter() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    e1 = _create_emotion(client, "Confident")
    e2 = _create_emotion(client, "Fearful")

    _trade(client, asset_id, "2024-01-10", 120.0, emotion_ids=[e1])
    _trade(client, asset_id, "2024-02-10", 110.0, emotion_ids=[e2])

    confident = _stats(client, f"?emotion_ids={e1}")

  assert confident["statistics"]["total_trades"] == 1
  assert confident["statistics"]["total_pnl"] == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# 10. Timeframe filter + available filters reflect data
# ---------------------------------------------------------------------------


def test_statistics_timeframe_filter_and_available() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0, timeframe_unit="m", timeframe_value=15)
    _trade(client, asset_id, "2024-02-10", 110.0, timeframe_unit="h", timeframe_value=1)

    data = _stats(client)
    m15 = _stats(client, "?entry_timeframe=15m")

  assert set(data["available_filters"]["timeframes"]) == {"15m", "1h"}
  assert m15["statistics"]["total_trades"] == 1
  assert m15["statistics"]["total_pnl"] == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# 11. P&L and duration range filters
# ---------------------------------------------------------------------------


def test_statistics_pnl_range_filter() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)  # +2R
    _trade(client, asset_id, "2024-02-10", 110.0)  # +1R
    _trade(client, asset_id, "2024-03-10", 90.0)   # -1R

    gte = _stats(client, "?pnl_operator=gte&pnl_value=1.5")
    lte = _stats(client, "?pnl_operator=lte&pnl_value=0")

  assert gte["statistics"]["total_trades"] == 1  # only +2R
  assert lte["statistics"]["total_trades"] == 1  # only -1R


def test_statistics_duration_range_filter() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    # Same-day trade → duration 0 minutes.
    _trade(client, asset_id, "2024-01-10", 120.0)
    # Two-day span → duration 2 days.
    _trade(
      client, asset_id, "2024-02-10", 110.0, exit_date="2024-02-12"
    )

    gte_day = _stats(client, "?duration_operator=gte&duration_value=1&duration_unit=days")

  assert gte_day["statistics"]["total_trades"] == 1
  assert gte_day["statistics"]["total_pnl"] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# 12. Combined filters
# ---------------------------------------------------------------------------


def test_statistics_combined_filters() -> None:
  with TestClient(app) as client:
    a1 = _create_asset(client, name="EURUSD")
    a2 = _create_asset(client, name="GBPUSD")
    tag = _create_tag(client, "Breakout")

    # Target trade: a1, live, tagged, in range.
    _trade(client, a1, "2024-05-10", 120.0, account_type="live", tag_ids=[tag])
    # Noise: wrong asset.
    _trade(client, a2, "2024-05-10", 130.0, account_type="live", tag_ids=[tag])
    # Noise: wrong type.
    _trade(client, a1, "2024-05-10", 130.0, account_type="demo", tag_ids=[tag])
    # Noise: out of date range.
    _trade(client, a1, "2024-01-10", 130.0, account_type="live", tag_ids=[tag])

    data = _stats(
      client,
      f"?asset_ids={a1}&types=Live&tag_ids={tag}"
      "&date_from=2024-03-01&date_to=2024-09-01",
    )

  assert data["statistics"]["total_trades"] == 1
  assert data["statistics"]["total_pnl"] == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# 13. Available filters reflect actual data
# ---------------------------------------------------------------------------


def test_available_filters_reflect_data() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client, name="EURUSD", currency="USD")
    tag = _create_tag(client, "Breakout")
    emotion = _create_emotion(client, "Confident")
    _trade(
      client,
      asset_id,
      "2024-01-15",
      120.0,
      account_type="live",
      tag_ids=[tag],
      emotion_ids=[emotion],
      timeframe_unit="m",
      timeframe_value=15,
    )
    _trade(client, asset_id, "2026-06-10", 110.0, account_type="demo")

    f = _stats(client)["available_filters"]

  assert f["assets"] == [{"id": asset_id, "name": "EURUSD", "currency": "USD"}]
  assert f["directions"] == ["Long"]
  assert f["timeframes"] == ["15m"]
  assert f["tags"] == [{"id": tag, "name": "Breakout"}]
  assert f["emotions"] == [{"id": emotion, "name": "Confident"}]
  assert f["types"] == ["Live", "Demo"]
  assert f["date_range"] == {"min": "2024-01-15", "max": "2026-06-10"}


# ---------------------------------------------------------------------------
# 14. Empty filters return unfiltered results
# ---------------------------------------------------------------------------


def test_statistics_empty_filters_return_all() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)
    _trade(client, asset_id, "2024-02-10", 110.0)
    data = _stats(client)

  assert data["statistics"]["total_trades"] == 2


# ---------------------------------------------------------------------------
# 15. Trades endpoint — pagination and sorting
# ---------------------------------------------------------------------------


def _trades(client: TestClient, query: str = "") -> dict:
  resp = client.get(f"/api/analytics/trades{query}")
  assert resp.status_code == 200, resp.text
  body = resp.json()
  assert body["error"] is None
  return body["data"]


def test_trades_pagination() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    for i in range(1, 6):
      _trade(client, asset_id, f"2024-0{i}-10", 110.0)

    page1 = _trades(client, "?page=1&per_page=2")
    page3 = _trades(client, "?page=3&per_page=2")

  assert page1["pagination"] == {"page": 1, "per_page": 2, "total": 5, "total_pages": 3}
  assert len(page1["trades"]) == 2
  assert page3["pagination"]["page"] == 3
  assert len(page3["trades"]) == 1  # remainder


def test_trades_sorting_by_performance() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)  # +2R
    _trade(client, asset_id, "2024-02-10", 90.0)   # -1R
    _trade(client, asset_id, "2024-03-10", 130.0)  # +3R

    asc = _trades(client, "?sort_by=performance_r&sort_order=asc")
    desc = _trades(client, "?sort_by=performance_r&sort_order=desc")

  asc_perfs = [t["performance_r"] for t in asc["trades"]]
  desc_perfs = [t["performance_r"] for t in desc["trades"]]
  assert asc_perfs == [-1.0, 2.0, 3.0]
  assert desc_perfs == [3.0, 2.0, -1.0]


def test_trades_default_sort_is_trade_date_desc() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)
    _trade(client, asset_id, "2024-03-10", 110.0)
    _trade(client, asset_id, "2024-02-10", 130.0)

    data = _trades(client)

  dates = [t["trade_date"] for t in data["trades"]]
  assert dates == ["2024-03-10", "2024-02-10", "2024-01-10"]


def test_trades_respects_filters_and_missed_default() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _trade(client, asset_id, "2024-01-10", 120.0)
    _trade(client, asset_id, "2024-02-10", 130.0, missed_opportunity=True)

    default = _trades(client)
    included = _trades(client, "?include_missed=true")

  assert default["pagination"]["total"] == 1
  assert included["pagination"]["total"] == 2


# ---------------------------------------------------------------------------
# 16. Response envelope shape
# ---------------------------------------------------------------------------


def test_statistics_response_envelope_shape() -> None:
  with TestClient(app) as client:
    data = _stats(client)

  assert set(data.keys()) == {"statistics", "available_filters"}
  expected_stat_keys = {
    "total_trades", "winning_trades", "losing_trades", "breakeven_trades",
    "total_pnl", "avg_pnl", "win_rate", "avg_win", "avg_loss", "expectancy",
    "profit_factor", "avg_duration_hours", "winning_streak", "losing_streak",
    "best_trade", "worst_trade",
  }
  assert set(data["statistics"].keys()) == expected_stat_keys
  expected_filter_keys = {
    "assets", "directions", "timeframes", "tags", "emotions", "types", "date_range",
  }
  assert set(data["available_filters"].keys()) == expected_filter_keys


def test_invalid_int_list_returns_400() -> None:
  with TestClient(app) as client:
    resp = client.get("/api/analytics/statistics?asset_ids=abc")

  assert resp.status_code == 400
  assert resp.json()["error"] is not None
