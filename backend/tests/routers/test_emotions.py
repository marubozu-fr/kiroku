from fastapi.testclient import TestClient
from httpx import Response

from app.main import app


def _create(client: TestClient, **overrides: object) -> Response:
  payload = {
    "name": "Fear of missing out",
    "description": "Chasing a move already gone",
    "severity": "Bad",
    "category": "Mental Triggers",
  }
  payload.update(overrides)
  return client.post("/api/emotions", json=payload)


def test_create_emotion_happy_path() -> None:
  with TestClient(app) as client:
    response = _create(client)

  assert response.status_code == 201
  body = response.json()
  assert body["error"] is None
  data = body["data"]
  assert data["id"] > 0
  assert data["name"] == "Fear of missing out"
  assert data["description"] == "Chasing a move already gone"
  assert data["severity"] == "Bad"
  assert data["category"] == "Mental Triggers"
  assert data["created_at"] is not None
  assert data["updated_at"] is not None


def test_create_emotion_without_description() -> None:
  with TestClient(app) as client:
    response = _create(client, name="Calm focus", description=None, severity="Good")

  assert response.status_code == 201
  assert response.json()["data"]["description"] is None


def test_create_emotion_invalid_severity() -> None:
  with TestClient(app) as client:
    response = _create(client, severity="Terrible")

  assert response.status_code == 422
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_create_emotion_invalid_category() -> None:
  with TestClient(app) as client:
    response = _create(client, category="Random Category")

  assert response.status_code == 422
  assert response.json()["data"] is None


def test_create_emotion_name_too_short() -> None:
  with TestClient(app) as client:
    response = _create(client, name="XY")

  assert response.status_code == 422


def test_create_emotion_name_too_long() -> None:
  with TestClient(app) as client:
    response = _create(client, name="X" * 101)

  assert response.status_code == 422


def test_create_emotion_description_too_long() -> None:
  with TestClient(app) as client:
    response = _create(client, description="X" * 501)

  assert response.status_code == 422


def test_list_emotions_returns_all() -> None:
  with TestClient(app) as client:
    _create(client, name="Greed")
    _create(client, name="Anxiety")
    response = client.get("/api/emotions")

  assert response.status_code == 200
  data = response.json()["data"]
  assert [emotion["name"] for emotion in data] == ["Anxiety", "Greed"]


def test_list_emotions_category_filter() -> None:
  with TestClient(app) as client:
    triggers = _create(client, name="Revenge trade", category="Mental Triggers")
    _create(client, name="Patient entry", category="Execution Confidence")

    response = client.get("/api/emotions", params={"category": "Mental Triggers"})

  assert response.status_code == 200
  data = response.json()["data"]
  assert [emotion["id"] for emotion in data] == [triggers.json()["data"]["id"]]


def test_list_emotions_invalid_category_filter() -> None:
  with TestClient(app) as client:
    response = client.get("/api/emotions", params={"category": "Nope"})

  assert response.status_code == 422


def test_grouped_emotions_returns_all_categories() -> None:
  with TestClient(app) as client:
    _create(client, name="Revenge trade", category="Mental Triggers")
    _create(client, name="FOMO entry", category="Mental Triggers")
    _create(client, name="Calm focus", category="Focus & Clarity")
    response = client.get("/api/emotions/grouped")

  assert response.status_code == 200
  data = response.json()["data"]
  assert set(data.keys()) == {
    "Emotional State",
    "Mental Triggers",
    "Focus & Clarity",
    "Execution Confidence",
    "Why This Trade?",
  }
  assert [emotion["name"] for emotion in data["Mental Triggers"]] == [
    "FOMO entry",
    "Revenge trade",
  ]
  assert [emotion["name"] for emotion in data["Focus & Clarity"]] == ["Calm focus"]
  assert data["Emotional State"] == []


def test_get_emotion_happy_path() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.get(f"/api/emotions/{created['id']}")

  assert response.status_code == 200
  assert response.json()["data"]["id"] == created["id"]


def test_get_emotion_not_found() -> None:
  with TestClient(app) as client:
    response = client.get("/api/emotions/999")

  assert response.status_code == 404
  body = response.json()
  assert body["data"] is None
  assert "not found" in body["error"].lower()


def test_update_emotion_happy_path() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.put(
      f"/api/emotions/{created['id']}",
      json={"severity": "Warning", "description": "Updated"},
    )

  assert response.status_code == 200
  data = response.json()["data"]
  assert data["severity"] == "Warning"
  assert data["description"] == "Updated"
  assert data["name"] == "Fear of missing out"


def test_update_emotion_invalid_severity() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.put(f"/api/emotions/{created['id']}", json={"severity": "Awful"})

  assert response.status_code == 422


def test_update_emotion_not_found() -> None:
  with TestClient(app) as client:
    response = client.put("/api/emotions/999", json={"description": "x"})

  assert response.status_code == 404
  assert response.json()["error"] is not None


def test_delete_emotion_hard_deletes() -> None:
  with TestClient(app) as client:
    created = _create(client).json()["data"]
    response = client.delete(f"/api/emotions/{created['id']}")

    assert response.status_code == 200
    assert response.json()["data"]["id"] == created["id"]

    # Hard delete: the row is gone.
    fetched = client.get(f"/api/emotions/{created['id']}")
    assert fetched.status_code == 404


def test_delete_emotion_not_found() -> None:
  with TestClient(app) as client:
    response = client.delete("/api/emotions/999")

  assert response.status_code == 404
  assert response.json()["error"] is not None
