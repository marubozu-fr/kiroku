from fastapi.testclient import TestClient
from httpx import Response

from app.main import app


def _create(client: TestClient, **overrides: object) -> Response:
  payload = {"name": "EUR/USD", "category": "Forex", "currency": "USD"}
  payload.update(overrides)
  return client.post("/api/assets", json=payload)


def _create_trade_for_asset(client: TestClient, asset_id: int) -> int:
  response = client.post(
    "/api/trades",
    json={
      "asset_id": asset_id,
      "activities": [
        {"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-03-15"},
      ],
    },
  )
  assert response.status_code == 201, response.text
  return response.json()["data"]["id"]


def test_create_asset_happy_path() -> None:
  with TestClient(app) as client:
    response = _create(client)

  assert response.status_code == 201
  body = response.json()
  assert body["error"] is None
  data = body["data"]
  assert data["id"] > 0
  assert data["name"] == "EUR/USD"
  assert data["category"] == "Forex"
  assert data["currency"] == "USD"
  assert data["is_active"] is True
  assert data["created_at"] is not None
  assert data["updated_at"] is not None


def test_create_asset_without_currency() -> None:
  with TestClient(app) as client:
    response = client.post("/api/assets", json={"name": "BTC", "category": "Crypto"})

  assert response.status_code == 201
  assert response.json()["data"]["currency"] is None


def test_list_assets_returns_all() -> None:
  with TestClient(app) as client:
    _create(client, name="EUR/USD")
    _create(client, name="GBP/USD")
    response = client.get("/api/assets")

  assert response.status_code == 200
  data = response.json()["data"]
  assert [asset["name"] for asset in data] == ["EUR/USD", "GBP/USD"]


def test_list_assets_active_filter() -> None:
  with TestClient(app) as client:
    active = _create(client, name="EUR/USD").json()["data"]
    inactive = _create(client, name="GBP/USD").json()["data"]
    client.put(f"/api/assets/{inactive['id']}", json={"is_active": False})

    response = client.get("/api/assets", params={"active": "true"})

  data = response.json()["data"]
  assert [asset["id"] for asset in data] == [active["id"]]


def test_get_asset_happy_path() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.get(f"/api/assets/{created['id']}")

  assert response.status_code == 200
  assert response.json()["data"]["id"] == created["id"]


def test_get_asset_not_found() -> None:
  with TestClient(app) as client:
    response = client.get("/api/assets/999")

  assert response.status_code == 404
  body = response.json()
  assert body["data"] is None
  assert "not found" in body["error"].lower()


def test_update_asset_happy_path() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.put(
      f"/api/assets/{created['id']}", json={"currency": "EUR"}
    )

  assert response.status_code == 200
  data = response.json()["data"]
  assert data["currency"] == "EUR"
  assert data["name"] == "EUR/USD"


def test_update_asset_not_found() -> None:
  with TestClient(app) as client:
    response = client.put("/api/assets/999", json={"currency": "EUR"})

  assert response.status_code == 404
  assert response.json()["error"] is not None


def test_update_asset_duplicate_name() -> None:
  with TestClient(app) as client:
    _create(client, name="EUR/USD")
    other = _create(client, name="GBP/USD").json()["data"]
    response = client.put(
      f"/api/assets/{other['id']}", json={"name": "EUR/USD"}
    )

  assert response.status_code == 409
  assert response.json()["error"] is not None


def test_delete_asset_hard_deletes() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.delete(f"/api/assets/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""

    # Hard delete: the row is gone.
    fetched = client.get(f"/api/assets/{created['id']}")
    assert fetched.status_code == 404


def test_update_asset_deactivates_and_reactivates() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    client.put(f"/api/assets/{created['id']}", json={"is_active": False})

    response = client.put(
      f"/api/assets/{created['id']}", json={"is_active": True}
    )

    assert response.status_code == 200
    assert response.json()["data"]["is_active"] is True


def test_delete_asset_not_found() -> None:
  with TestClient(app) as client:
    response = client.delete("/api/assets/999")

  assert response.status_code == 404
  assert response.json()["error"] is not None


def test_delete_asset_blocked_when_trades_exist() -> None:
  with TestClient(app) as client:
    asset_id = _create(client).json()["data"]["id"]
    _create_trade_for_asset(client, asset_id)

    response = client.delete(f"/api/assets/{asset_id}")

    assert response.status_code == 409
    body = response.json()
    assert body["data"] is None
    assert body["error"] == (
      "Asset is associated with 1 trade(s) and cannot be deleted."
    )

    # The asset is untouched.
    assert client.get(f"/api/assets/{asset_id}").status_code == 200


def test_delete_asset_succeeds_without_trades() -> None:
  with TestClient(app) as client:
    asset_id = _create(client).json()["data"]["id"]

    response = client.delete(f"/api/assets/{asset_id}")

    assert response.status_code == 204
    assert client.get(f"/api/assets/{asset_id}").status_code == 404


def test_asset_trade_count_zero() -> None:
  with TestClient(app) as client:
    asset_id = _create(client).json()["data"]["id"]
    response = client.get(f"/api/assets/{asset_id}/trade-count")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  assert body["data"]["trade_count"] == 0


def test_asset_trade_count_with_trades() -> None:
  with TestClient(app) as client:
    asset_id = _create(client).json()["data"]["id"]
    _create_trade_for_asset(client, asset_id)
    _create_trade_for_asset(client, asset_id)

    response = client.get(f"/api/assets/{asset_id}/trade-count")

  assert response.status_code == 200
  assert response.json()["data"]["trade_count"] == 2


def test_asset_trade_count_not_found() -> None:
  with TestClient(app) as client:
    response = client.get("/api/assets/999/trade-count")

  assert response.status_code == 404
  body = response.json()
  assert body["data"] is None
  assert "not found" in body["error"].lower()


def test_create_asset_name_too_short() -> None:
  with TestClient(app) as client:
    response = client.post("/api/assets", json={"name": "X", "category": "Forex"})

  assert response.status_code == 422
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_create_asset_name_too_long() -> None:
  with TestClient(app) as client:
    response = client.post(
      "/api/assets", json={"name": "X" * 51, "category": "Forex"}
    )

  assert response.status_code == 422


def test_create_asset_invalid_category() -> None:
  with TestClient(app) as client:
    response = client.post(
      "/api/assets", json={"name": "EUR/USD", "category": "Bonds"}
    )

  assert response.status_code == 422


def test_create_asset_duplicate_name() -> None:
  with TestClient(app) as client:
    _create(client)
    response = _create(client)

  assert response.status_code == 409
  body = response.json()
  assert body["data"] is None
  assert "already exists" in body["error"].lower()
