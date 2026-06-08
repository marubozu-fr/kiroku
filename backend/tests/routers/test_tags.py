from fastapi.testclient import TestClient
from httpx import Response

from app.main import app


def _create(client: TestClient, **overrides: object) -> Response:
  payload = {"name": "Double Top", "description": "Reversal at resistance"}
  payload.update(overrides)
  return client.post("/api/tags", json=payload)


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
    client.delete(f"/api/tags/{inactive['id']}")

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


def test_delete_tag_soft_deletes() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.delete(f"/api/tags/{created['id']}")

    assert response.status_code == 200
    assert response.json()["data"]["is_active"] is False

    # The row still exists, just inactive.
    fetched = client.get(f"/api/tags/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["is_active"] is False


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
