import pytest
from fastapi.testclient import TestClient
from httpx import Response

from app.main import app

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _create_asset(client: TestClient, name: str = "EURUSD", category: str = "Forex") -> int:
  resp = client.post("/api/assets", json={"name": name, "category": category})
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _create_tag(client: TestClient, name: str = "Breakout") -> int:
  resp = client.post("/api/tags", json={"name": name})
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _create_emotion(
  client: TestClient,
  name: str = "Fear of missing out",
  severity: str = "Bad",
  category: str = "Mental Triggers",
) -> int:
  resp = client.post("/api/emotions", json={"name": name, "severity": severity, "category": category})
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
# 1. Create happy path — Long trade, two Buy entries + one Sell exit (Closed)
# ---------------------------------------------------------------------------


def test_create_long_trade_closed_happy_path() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 1.0900,
        "notes": "Textbook breakout",
        "activities": [
          {"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-03-15"},
          {"type": "Buy", "price": 1.1020, "quantity": 1.0, "date": "2024-03-16"},
          {"type": "Sell", "price": 1.1200, "quantity": 2.0, "date": "2024-03-17"},
        ],
      },
    )

  assert response.status_code == 201
  body = response.json()
  assert body["error"] is None
  data = body["data"]

  assert data["id"] > 0
  assert data["direction"] == "Long"
  assert data["status"] == "Closed"
  assert data["trade_date"] == "2024-03-15"
  assert data["notes"] == "Textbook breakout"
  assert data["created_at"] is not None
  assert data["updated_at"] is not None

  # avg_entry = (1.1000*1 + 1.1020*1) / 2 = 1.1010
  assert data["avg_entry_price"] == pytest.approx(1.1010)
  # avg_exit = 1.1200
  assert data["avg_exit_price"] == pytest.approx(1.1200)
  # risk = abs(1.1010 - 1.0900) = 0.0110
  assert data["risk"] == pytest.approx(0.0110)
  # reward (Long) = avg_exit - avg_entry = 1.1200 - 1.1010 = +0.0190 (winner)
  assert data["reward"] == pytest.approx(0.0190)
  # performance_r = +0.0190 / 0.0110 (positive R for a winning trade)
  assert data["performance_r"] == pytest.approx(0.0190 / 0.0110)

  # Nested activities — check is_entry flags
  activities = data["activities"]
  assert len(activities) == 3
  by_type = {(a["type"], a["date"]): a for a in activities}
  assert by_type[("Buy", "2024-03-15")]["is_entry"] is True
  assert by_type[("Buy", "2024-03-16")]["is_entry"] is True
  assert by_type[("Sell", "2024-03-17")]["is_entry"] is False

  # Screenshots is empty
  assert data["screenshots"] == []


# ---------------------------------------------------------------------------
# 2. Create Short trade — first activity is Sell
# ---------------------------------------------------------------------------


def test_create_short_trade() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "activities": [
          {"type": "Sell", "price": 1.1200, "quantity": 2.0, "date": "2024-04-01"},
          {"type": "Buy", "price": 1.1050, "quantity": 2.0, "date": "2024-04-03"},
        ],
      },
    )

  assert response.status_code == 201
  data = response.json()["data"]
  assert data["direction"] == "Short"
  assert data["status"] == "Closed"
  assert data["trade_date"] == "2024-04-01"

  # Entries are the Sell activities
  for activity in data["activities"]:
    if activity["type"] == "Sell":
      assert activity["is_entry"] is True
    else:
      assert activity["is_entry"] is False


# ---------------------------------------------------------------------------
# 3. Status variations
# ---------------------------------------------------------------------------


def test_status_open() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = _create(
      client,
      asset_id,
      activities=[{"type": "Buy", "price": 1.1000, "quantity": 5.0, "date": "2024-05-01"}],
    )

  assert response.status_code == 201
  assert response.json()["data"]["status"] == "Open"


def test_status_partial() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "activities": [
          {"type": "Buy", "price": 1.1000, "quantity": 10.0, "date": "2024-05-01"},
          {"type": "Sell", "price": 1.1100, "quantity": 4.0, "date": "2024-05-02"},
        ],
      },
    )

  assert response.status_code == 201
  assert response.json()["data"]["status"] == "Partial"


def test_status_closed() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "activities": [
          {"type": "Buy", "price": 1.1000, "quantity": 3.0, "date": "2024-05-01"},
          {"type": "Sell", "price": 1.1200, "quantity": 3.0, "date": "2024-05-03"},
        ],
      },
    )

  assert response.status_code == 201
  assert response.json()["data"]["status"] == "Closed"


def test_status_breakeven() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 1.0900,
        "activities": [
          {"type": "Buy", "price": 1.1000, "quantity": 2.0, "date": "2024-05-01"},
          {"type": "Sell", "price": 1.1000, "quantity": 2.0, "date": "2024-05-02"},
        ],
      },
    )

  assert response.status_code == 201
  data = response.json()["data"]
  assert data["status"] == "Breakeven"
  # reward is 0, performance_r should be 0.0 (reward=0, risk>0 → 0/risk=0)
  assert data["reward"] == pytest.approx(0.0)
  assert data["performance_r"] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# 4. Calculation accuracy — weighted average with unequal quantities
# ---------------------------------------------------------------------------


def test_weighted_avg_entry_price_accuracy() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    # Entry 1: price=100, qty=1 → contribution 100
    # Entry 2: price=110, qty=3 → contribution 330
    # avg = 430/4 = 107.5
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 95.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-06-01"},
          {"type": "Buy", "price": 110.0, "quantity": 3.0, "date": "2024-06-02"},
          {"type": "Sell", "price": 120.0, "quantity": 4.0, "date": "2024-06-03"},
        ],
      },
    )

  assert response.status_code == 201
  data = response.json()["data"]
  assert data["avg_entry_price"] == pytest.approx(107.5)
  assert data["avg_exit_price"] == pytest.approx(120.0)
  # risk = abs(107.5 - 95.0) = 12.5
  assert data["risk"] == pytest.approx(12.5)
  # reward (Long) = 120.0 - 107.5 = +12.5 (winner)
  assert data["reward"] == pytest.approx(12.5)
  # performance_r = +12.5 / 12.5 = +1.0R
  assert data["performance_r"] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# 4b. Signed R — losing trades show a negative reward and negative R
# ---------------------------------------------------------------------------


def test_losing_long_trade_has_negative_r() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    # Long: entry 100, stop 95 (risk 5), exit 90 below entry → loss.
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 95.0,
        "activities": [
          {"type": "Buy", "price": 100.0, "quantity": 1.0, "date": "2024-08-01"},
          {"type": "Sell", "price": 90.0, "quantity": 1.0, "date": "2024-08-02"},
        ],
      },
    )

  assert response.status_code == 201
  data = response.json()["data"]
  assert data["direction"] == "Long"
  assert data["status"] == "Closed"
  # risk stays a positive magnitude.
  assert data["risk"] == pytest.approx(5.0)
  # reward (Long) = 90 - 100 = -10 (price moved against the position).
  assert data["reward"] == pytest.approx(-10.0)
  # performance_r = -10 / 5 = -2.0R.
  assert data["performance_r"] == pytest.approx(-2.0)


def test_losing_short_trade_has_negative_r() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    # Short: entry 100 (Sell first), stop 105 (risk 5), exit 110 above entry → loss.
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 105.0,
        "activities": [
          {"type": "Sell", "price": 100.0, "quantity": 1.0, "date": "2024-08-01"},
          {"type": "Buy", "price": 110.0, "quantity": 1.0, "date": "2024-08-02"},
        ],
      },
    )

  assert response.status_code == 201
  data = response.json()["data"]
  assert data["direction"] == "Short"
  assert data["status"] == "Closed"
  assert data["risk"] == pytest.approx(5.0)
  # reward (Short) = avg_entry - avg_exit = 100 - 110 = -10 (price rose against the short).
  assert data["reward"] == pytest.approx(-10.0)
  assert data["performance_r"] == pytest.approx(-2.0)


def test_winning_short_trade_has_positive_r() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    # Short: entry 100 (Sell first), stop 105 (risk 5), exit 90 below entry → profit.
    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "stop_loss": 105.0,
        "activities": [
          {"type": "Sell", "price": 100.0, "quantity": 1.0, "date": "2024-08-01"},
          {"type": "Buy", "price": 90.0, "quantity": 1.0, "date": "2024-08-02"},
        ],
      },
    )

  assert response.status_code == 201
  data = response.json()["data"]
  # reward (Short) = 100 - 90 = +10 (winning short).
  assert data["reward"] == pytest.approx(10.0)
  assert data["performance_r"] == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# 5. risk/reward/performance_r None when stop_loss omitted or no exits
# ---------------------------------------------------------------------------


def test_open_trade_reward_and_performance_r_none() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = _create(
      client,
      asset_id,
      activities=[{"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-07-01"}],
    )

  assert response.status_code == 201
  data = response.json()["data"]
  assert data["risk"] is None
  assert data["reward"] is None
  assert data["performance_r"] is None


def test_open_trade_with_stop_loss_has_risk_but_no_reward() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = _create(
      client,
      asset_id,
      stop_loss=1.0900,
      activities=[{"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-07-01"}],
    )

  assert response.status_code == 201
  data = response.json()["data"]
  assert data["risk"] == pytest.approx(0.01)
  assert data["reward"] is None
  assert data["performance_r"] is None


# ---------------------------------------------------------------------------
# 6. Tags & emotions — nested in GET detail, ordered by name
# ---------------------------------------------------------------------------


def test_create_trade_with_tags_and_emotions() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    tag_id_z = _create_tag(client, name="Trend Following")
    tag_id_a = _create_tag(client, name="Breakout")
    emo_id_z = _create_emotion(client, name="Revenge trading", severity="Bad", category="Mental Triggers")
    emo_id_a = _create_emotion(client, name="Calm focus", severity="Good", category="Focus & Clarity")

    response = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "tag_ids": [tag_id_z, tag_id_a],
        "emotion_ids": [emo_id_z, emo_id_a],
        "activities": [{"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-08-01"}],
      },
    )
    assert response.status_code == 201
    trade_id = response.json()["data"]["id"]
    detail = client.get(f"/api/trades/{trade_id}")

  assert detail.status_code == 200
  data = detail.json()["data"]
  assert [t["name"] for t in data["tags"]] == ["Breakout", "Trend Following"]
  assert [e["name"] for e in data["emotions"]] == ["Calm focus", "Revenge trading"]


# ---------------------------------------------------------------------------
# 7. Validation errors
# ---------------------------------------------------------------------------


def test_create_trade_missing_activities_empty_list() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = _create(client, asset_id, activities=[])

  assert response.status_code == 422
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_create_trade_invalid_activity_type() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = _create(
      client,
      asset_id,
      activities=[{"type": "Hold", "price": 1.1000, "quantity": 1.0, "date": "2024-03-15"}],
    )

  assert response.status_code == 422
  assert response.json()["data"] is None


def test_create_trade_nonexistent_asset_id() -> None:
  with TestClient(app) as client:
    response = _create(client, asset_id=9999)

  assert response.status_code == 404
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_create_trade_nonexistent_tag_id() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = _create(client, asset_id, tag_ids=[9999])

  assert response.status_code == 404
  assert response.json()["data"] is None


def test_create_trade_nonexistent_emotion_id() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = _create(client, asset_id, emotion_ids=[9999])

  assert response.status_code == 404
  assert response.json()["data"] is None


def test_create_trade_activity_price_zero() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = _create(
      client,
      asset_id,
      activities=[{"type": "Buy", "price": 0.0, "quantity": 1.0, "date": "2024-03-15"}],
    )

  assert response.status_code == 422
  assert response.json()["data"] is None


def test_create_trade_activity_price_negative() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    response = _create(
      client,
      asset_id,
      activities=[{"type": "Buy", "price": -1.0, "quantity": 1.0, "date": "2024-03-15"}],
    )

  assert response.status_code == 422
  assert response.json()["data"] is None


# ---------------------------------------------------------------------------
# 8. GET list — summaries, filters
# ---------------------------------------------------------------------------


def test_list_trades_returns_summaries() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _create(client, asset_id, activities=[{"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2024-01-10"}])
    _create(client, asset_id, activities=[{"type": "Buy", "price": 1.2, "quantity": 1.0, "date": "2024-01-11"}])
    response = client.get("/api/trades")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  data = body["data"]
  assert len(data) == 2
  # Summaries must not contain nested arrays
  for trade in data:
    assert "activities" not in trade
    assert "tags" not in trade
    assert "emotions" not in trade


def test_list_trades_filter_by_asset_id() -> None:
  with TestClient(app) as client:
    asset_a = _create_asset(client, name="EURUSD")
    asset_b = _create_asset(client, name="GBPUSD")
    _create(client, asset_a, activities=[{"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2024-02-01"}])
    _create(client, asset_b, activities=[{"type": "Buy", "price": 1.3, "quantity": 1.0, "date": "2024-02-02"}])
    response = client.get("/api/trades", params={"asset_id": asset_a})

  assert response.status_code == 200
  data = response.json()["data"]
  assert len(data) == 1
  assert data[0]["asset_id"] == asset_a


def test_list_trades_filter_by_status() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    # Open trade
    _create(client, asset_id, activities=[{"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2024-03-01"}])
    # Closed trade
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "activities": [
          {"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2024-03-02"},
          {"type": "Sell", "price": 1.2, "quantity": 1.0, "date": "2024-03-03"},
        ],
      },
    )
    response = client.get("/api/trades", params={"status": "Open"})

  assert response.status_code == 200
  data = response.json()["data"]
  assert len(data) == 1
  assert data[0]["status"] == "Open"


def test_list_trades_filter_by_direction() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    # Long trade
    _create(client, asset_id, activities=[{"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2024-04-01"}])
    # Short trade
    _create(client, asset_id, activities=[{"type": "Sell", "price": 1.1, "quantity": 1.0, "date": "2024-04-02"}])
    response = client.get("/api/trades", params={"direction": "Long"})

  assert response.status_code == 200
  data = response.json()["data"]
  assert len(data) == 1
  assert data[0]["direction"] == "Long"


def test_list_trades_filter_by_year() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _create(client, asset_id, activities=[{"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2023-06-15"}])
    _create(client, asset_id, activities=[{"type": "Buy", "price": 1.2, "quantity": 1.0, "date": "2024-06-15"}])
    response = client.get("/api/trades", params={"year": 2023})

  assert response.status_code == 200
  data = response.json()["data"]
  assert len(data) == 1
  assert data[0]["trade_date"] == "2023-06-15"


def test_list_trades_combination_filter() -> None:
  with TestClient(app) as client:
    asset_a = _create_asset(client, name="EURUSD")
    asset_b = _create_asset(client, name="GBPUSD")
    # Open Long on asset_a in 2024
    _create(client, asset_a, activities=[{"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2024-05-01"}])
    # Closed Long on asset_a in 2024
    client.post(
      "/api/trades",
      json={
        "asset_id": asset_a,
        "activities": [
          {"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2024-05-02"},
          {"type": "Sell", "price": 1.2, "quantity": 1.0, "date": "2024-05-03"},
        ],
      },
    )
    # Open Long on asset_b in 2024
    _create(client, asset_b, activities=[{"type": "Buy", "price": 1.3, "quantity": 1.0, "date": "2024-05-04"}])
    response = client.get("/api/trades", params={"asset_id": asset_a, "status": "Open", "year": 2024})

  assert response.status_code == 200
  data = response.json()["data"]
  assert len(data) == 1
  assert data[0]["asset_id"] == asset_a
  assert data[0]["status"] == "Open"


# ---------------------------------------------------------------------------
# 9. GET /years
# ---------------------------------------------------------------------------


def test_list_years_returns_distinct_years_descending() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    _create(client, asset_id, activities=[{"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2022-01-10"}])
    _create(client, asset_id, activities=[{"type": "Buy", "price": 1.1, "quantity": 1.0, "date": "2024-03-15"}])
    _create(client, asset_id, activities=[{"type": "Buy", "price": 1.2, "quantity": 1.0, "date": "2024-11-20"}])
    response = client.get("/api/trades/years")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  assert body["data"] == [2024, 2022]


def test_list_years_empty_when_no_trades() -> None:
  with TestClient(app) as client:
    response = client.get("/api/trades/years")

  assert response.status_code == 200
  assert response.json()["data"] == []


# ---------------------------------------------------------------------------
# 10. GET detail not found
# ---------------------------------------------------------------------------


def test_get_trade_not_found() -> None:
  with TestClient(app) as client:
    response = client.get("/api/trades/999")

  assert response.status_code == 404
  body = response.json()
  assert body["data"] is None
  assert "not found" in body["error"].lower()


# ---------------------------------------------------------------------------
# 11. PUT update
# ---------------------------------------------------------------------------


def test_update_trade_scalar_notes() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    created = _create(
      client,
      asset_id,
      stop_loss=1.0900,
      activities=[{"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-09-01"}],
    ).json()["data"]
    trade_id = created["id"]

    response = client.put(f"/api/trades/{trade_id}", json={"notes": "Updated notes"})

  assert response.status_code == 200
  data = response.json()["data"]
  assert data["notes"] == "Updated notes"
  # Computed fields unchanged
  assert data["avg_entry_price"] == pytest.approx(created["avg_entry_price"])
  assert data["risk"] == pytest.approx(created["risk"])
  assert data["status"] == created["status"]


def test_update_trade_stop_loss_recomputes_risk() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    trade_id = _create(
      client,
      asset_id,
      activities=[
        {"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-09-01"},
        {"type": "Sell", "price": 1.1200, "quantity": 1.0, "date": "2024-09-02"},
      ],
    ).json()["data"]["id"]

    response = client.put(f"/api/trades/{trade_id}", json={"stop_loss": 1.0800})

  assert response.status_code == 200
  data = response.json()["data"]
  # risk = abs(1.1000 - 1.0800) = 0.02
  assert data["risk"] == pytest.approx(0.02)
  # reward = abs(1.1200 - 1.1000) = 0.02
  assert data["reward"] == pytest.approx(0.02)
  # performance_r = 0.02 / 0.02 = 1.0
  assert data["performance_r"] == pytest.approx(1.0)


def test_update_trade_replace_activities_recomputes_metrics() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    trade_id = _create(
      client,
      asset_id,
      activities=[{"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-09-01"}],
    ).json()["data"]["id"]

    # Replace with a closed trade
    response = client.put(
      f"/api/trades/{trade_id}",
      json={
        "activities": [
          {"type": "Buy", "price": 1.1500, "quantity": 2.0, "date": "2024-09-10"},
          {"type": "Sell", "price": 1.2000, "quantity": 2.0, "date": "2024-09-11"},
        ]
      },
    )

  assert response.status_code == 200
  data = response.json()["data"]
  assert data["status"] == "Closed"
  assert data["avg_entry_price"] == pytest.approx(1.1500)
  assert data["avg_exit_price"] == pytest.approx(1.2000)
  assert len(data["activities"]) == 2


def test_update_trade_replace_tags_and_emotions() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    tag_1 = _create_tag(client, name="Breakout")
    tag_2 = _create_tag(client, name="Pullback")
    emo_1 = _create_emotion(client, name="Fear of missing out", severity="Bad", category="Mental Triggers")
    emo_2 = _create_emotion(client, name="Confident", severity="Good", category="Execution Confidence")

    trade_id = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "tag_ids": [tag_1],
        "emotion_ids": [emo_1],
        "activities": [{"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-09-15"}],
      },
    ).json()["data"]["id"]

    response = client.put(
      f"/api/trades/{trade_id}",
      json={"tag_ids": [tag_2], "emotion_ids": [emo_2]},
    )

  assert response.status_code == 200
  data = response.json()["data"]
  assert [t["name"] for t in data["tags"]] == ["Pullback"]
  assert [e["name"] for e in data["emotions"]] == ["Confident"]


def test_update_trade_not_found() -> None:
  with TestClient(app) as client:
    response = client.put("/api/trades/999", json={"notes": "ghost"})

  assert response.status_code == 404
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


# ---------------------------------------------------------------------------
# 12. DELETE — cascade, reference data intact
# ---------------------------------------------------------------------------


def test_delete_trade_returns_detail_and_404_afterward() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    trade_id = _create(
      client,
      asset_id,
      activities=[{"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-10-01"}],
    ).json()["data"]["id"]

    delete_response = client.delete(f"/api/trades/{trade_id}")
    assert delete_response.status_code == 200
    deleted_data = delete_response.json()["data"]
    assert deleted_data["id"] == trade_id

    # Row is gone
    get_response = client.get(f"/api/trades/{trade_id}")
    assert get_response.status_code == 404


def test_delete_trade_not_found() -> None:
  with TestClient(app) as client:
    response = client.delete("/api/trades/999")

  assert response.status_code == 404
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_delete_trade_cascade_leaves_tag_and_emotion_intact() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    tag_id = _create_tag(client, name="Breakout")
    emo_id = _create_emotion(client, name="Fear of missing out", severity="Bad", category="Mental Triggers")

    trade_id = client.post(
      "/api/trades",
      json={
        "asset_id": asset_id,
        "tag_ids": [tag_id],
        "emotion_ids": [emo_id],
        "activities": [{"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-10-05"}],
      },
    ).json()["data"]["id"]

    # Delete the trade
    client.delete(f"/api/trades/{trade_id}")

    # Reference rows in their own tables must still exist
    tag_resp = client.get(f"/api/tags/{tag_id}")
    emo_resp = client.get(f"/api/emotions/{emo_id}")

  assert tag_resp.status_code == 200
  assert tag_resp.json()["data"]["id"] == tag_id
  assert emo_resp.status_code == 200
  assert emo_resp.json()["data"]["id"] == emo_id

  # Trade itself is gone
  with TestClient(app) as client:
    assert client.get(f"/api/trades/{trade_id}").status_code == 404


def test_delete_trade_activities_gone_from_list() -> None:
  with TestClient(app) as client:
    asset_id = _create_asset(client)
    trade_id = _create(
      client,
      asset_id,
      activities=[{"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-10-10"}],
    ).json()["data"]["id"]

    client.delete(f"/api/trades/{trade_id}")

    # No trades remain
    list_resp = client.get("/api/trades")

  assert list_resp.status_code == 200
  assert list_resp.json()["data"] == []
