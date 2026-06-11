from fastapi.testclient import TestClient
from httpx import Response

from app.main import app


def _create(client: TestClient, **overrides: object) -> Response:
  payload = {"name": "Double Top", "description": "Reversal at resistance"}
  payload.update(overrides)
  return client.post("/api/tags", json=payload)


def _create_trade_with_tags(
  client: TestClient, tag_ids: list[int], asset_name: str = "EURUSD"
) -> int:
  asset_id = client.post(
    "/api/assets", json={"name": asset_name, "category": "Forex"}
  ).json()["data"]["id"]
  response = client.post(
    "/api/trades",
    json={
      "asset_id": asset_id,
      "tag_ids": tag_ids,
      "activities": [
        {"type": "Buy", "price": 1.1000, "quantity": 1.0, "date": "2024-03-15"},
      ],
    },
  )
  assert response.status_code == 201, response.text
  return response.json()["data"]["id"]


def test_create_tag_happy_path() -> None:
  with TestClient(app) as client:
    response = _create(client)

  assert response.status_code == 201
  body = response.json()
  assert body["error"] is None
  data = body["data"]
  assert data["id"] > 0
  assert data["name"] == "Double Top"
  assert data["description"] == "Reversal at resistance"
  assert data["is_active"] is True
  assert data["created_at"] is not None
  assert data["updated_at"] is not None


def test_create_tag_without_description() -> None:
  with TestClient(app) as client:
    response = client.post("/api/tags", json={"name": "Pullback"})

  assert response.status_code == 201
  assert response.json()["data"]["description"] is None


def test_list_tags_returns_all() -> None:
  with TestClient(app) as client:
    _create(client, name="Break of structure")
    _create(client, name="Double Top")
    response = client.get("/api/tags")

  assert response.status_code == 200
  data = response.json()["data"]
  assert [tag["name"] for tag in data] == ["Break of structure", "Double Top"]


def test_list_tags_active_filter() -> None:
  with TestClient(app) as client:
    active = _create(client, name="Double Top").json()["data"]
    inactive = _create(client, name="Pullback to level").json()["data"]
    client.put(f"/api/tags/{inactive['id']}", json={"is_active": False})

    response = client.get("/api/tags", params={"active": "true"})

  data = response.json()["data"]
  assert [tag["id"] for tag in data] == [active["id"]]


def test_get_tag_happy_path() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.get(f"/api/tags/{created['id']}")

  assert response.status_code == 200
  assert response.json()["data"]["id"] == created["id"]


def test_get_tag_not_found() -> None:
  with TestClient(app) as client:
    response = client.get("/api/tags/999")

  assert response.status_code == 404
  body = response.json()
  assert body["data"] is None
  assert "not found" in body["error"].lower()


def test_update_tag_happy_path() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.put(f"/api/tags/{created['id']}", json={"description": "Updated"})

  assert response.status_code == 200
  data = response.json()["data"]
  assert data["description"] == "Updated"
  assert data["name"] == "Double Top"


def test_update_tag_not_found() -> None:
  with TestClient(app) as client:
    response = client.put("/api/tags/999", json={"description": "x"})

  assert response.status_code == 404
  assert response.json()["error"] is not None


def test_update_tag_duplicate_name() -> None:
  with TestClient(app) as client:
    _create(client, name="Double Top")
    other = _create(client, name="Pullback to level").json()["data"]
    response = client.put(f"/api/tags/{other['id']}", json={"name": "Double Top"})

  assert response.status_code == 409
  assert response.json()["error"] is not None


def test_delete_tag_hard_deletes() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.delete(f"/api/tags/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""

    # The row is gone for good.
    fetched = client.get(f"/api/tags/{created['id']}")
    assert fetched.status_code == 404


def test_update_tag_reactivates() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    client.put(f"/api/tags/{created['id']}", json={"is_active": False})

    response = client.put(
      f"/api/tags/{created['id']}", json={"is_active": True}
    )

    assert response.status_code == 200
    assert response.json()["data"]["is_active"] is True


def test_delete_tag_not_found() -> None:
  with TestClient(app) as client:
    response = client.delete("/api/tags/999")

  assert response.status_code == 404
  assert response.json()["error"] is not None


def test_create_tag_name_too_short() -> None:
  with TestClient(app) as client:
    response = client.post("/api/tags", json={"name": "XY"})

  assert response.status_code == 422
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_create_tag_name_too_long() -> None:
  with TestClient(app) as client:
    response = client.post("/api/tags", json={"name": "X" * 101})

  assert response.status_code == 422


def test_create_tag_description_too_long() -> None:
  with TestClient(app) as client:
    response = client.post("/api/tags", json={"name": "Double Top", "description": "X" * 501})

  assert response.status_code == 422


def test_create_tag_duplicate_name() -> None:
  with TestClient(app) as client:
    _create(client)
    response = _create(client)

  assert response.status_code == 409
  body = response.json()
  assert body["data"] is None
  assert "already exists" in body["error"].lower()


def test_trade_count_zero() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.get(f"/api/tags/{created['id']}/trade-count")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  assert body["data"]["trade_count"] == 0


def test_trade_count_with_trades() -> None:
  with TestClient(app) as client:
    tag_id = _create(client).json()["data"]["id"]
    _create_trade_with_tags(client, [tag_id], asset_name="EURUSD")
    _create_trade_with_tags(client, [tag_id], asset_name="GBPUSD")

    response = client.get(f"/api/tags/{tag_id}/trade-count")

  assert response.status_code == 200
  assert response.json()["data"]["trade_count"] == 2


def test_trade_count_not_found() -> None:
  with TestClient(app) as client:
    response = client.get("/api/tags/999/trade-count")

  assert response.status_code == 404
  body = response.json()
  assert body["data"] is None
  assert "not found" in body["error"].lower()


def test_delete_tag_cascades_from_trades() -> None:
  with TestClient(app) as client:
    keep_id = _create(client, name="Keep me").json()["data"]["id"]
    drop_id = _create(client, name="Drop me").json()["data"]["id"]
    trade_id = _create_trade_with_tags(client, [keep_id, drop_id])

    response = client.delete(f"/api/tags/{drop_id}")
    assert response.status_code == 204

    # The tag is removed from the trade, the other tag survives.
    detail = client.get(f"/api/trades/{trade_id}").json()["data"]
    assert [tag["id"] for tag in detail["tags"]] == [keep_id]

    # The tag row itself is gone.
    assert client.get(f"/api/tags/{drop_id}").status_code == 404
