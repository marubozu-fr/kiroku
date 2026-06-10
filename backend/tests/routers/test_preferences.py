from fastapi.testclient import TestClient

from app.main import app


def test_get_preferences_returns_seeded_default() -> None:
  with TestClient(app) as client:
    response = client.get("/api/preferences")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  assert body["data"] == {"risk_per_trade_default": 1.0}


def test_patch_preferences_updates_field() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"risk_per_trade_default": 2.0}
    )

    assert response.status_code == 200
    assert response.json()["data"]["risk_per_trade_default"] == 2.0

    # The change is persisted for subsequent reads.
    assert client.get("/api/preferences").json()["data"][
      "risk_per_trade_default"
    ] == 2.0


def test_patch_preferences_empty_body_is_noop() -> None:
  with TestClient(app) as client:
    response = client.patch("/api/preferences", json={})

  assert response.status_code == 200
  assert response.json()["data"]["risk_per_trade_default"] == 1.0


def test_patch_preferences_rejects_zero() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"risk_per_trade_default": 0}
    )

  assert response.status_code == 422
  body = response.json()
  assert body["data"] is None
  assert body["error"] is not None


def test_patch_preferences_rejects_negative() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"risk_per_trade_default": -1.5}
    )

  assert response.status_code == 422
  assert response.json()["data"] is None


def test_patch_preferences_rejects_above_max() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"risk_per_trade_default": 100.1}
    )

  assert response.status_code == 422
  assert response.json()["data"] is None


def test_patch_preferences_accepts_boundary_max() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"risk_per_trade_default": 100}
    )

  assert response.status_code == 200
  assert response.json()["data"]["risk_per_trade_default"] == 100.0
