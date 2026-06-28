from fastapi.testclient import TestClient

from app.main import app


def test_get_preferences_returns_seeded_default() -> None:
  with TestClient(app) as client:
    response = client.get("/api/preferences")

  assert response.status_code == 200
  body = response.json()
  assert body["error"] is None
  assert body["data"] == {
    "risk_per_trade_default": 1.0,
    "news_enabled": True,
    "news_currencies": ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "NZD"],
    "news_min_impact": "MEDIUM",
    "backup_directory": None,
    "backup_reminder_days": 7,
    "last_backup_at": None,
    "massive_api_key": "",
    "chart_timeframes_default": [],
    "entry_timeframe_unit_default": None,
    "entry_timeframe_value_default": None,
    "chart_timeframes_warning_threshold": 8,
  }


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


def test_patch_preferences_saves_and_clears_massive_api_key() -> None:
  with TestClient(app) as client:
    saved = client.patch(
      "/api/preferences", json={"massive_api_key": "secret-key"}
    )
    assert saved.status_code == 200
    assert saved.json()["data"]["massive_api_key"] == "secret-key"
    assert (
      client.get("/api/preferences").json()["data"]["massive_api_key"]
      == "secret-key"
    )

    # An empty string clears the key (the column is NOT NULL).
    cleared = client.patch("/api/preferences", json={"massive_api_key": ""})
    assert cleared.json()["data"]["massive_api_key"] == ""


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


def test_patch_preferences_updates_news_fields() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences",
      json={
        "news_enabled": False,
        "news_currencies": ["USD", "EUR"],
        "news_min_impact": "HIGH",
      },
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["news_enabled"] is False
    assert data["news_currencies"] == ["USD", "EUR"]
    assert data["news_min_impact"] == "HIGH"

    # The currency list round-trips through its JSON column on the next read.
    reread = client.get("/api/preferences").json()["data"]
    assert reread["news_currencies"] == ["USD", "EUR"]


def test_patch_preferences_rejects_invalid_min_impact() -> None:
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences", json={"news_min_impact": "NONE"}
    )

  assert response.status_code == 422
  assert response.json()["data"] is None


# ---------------------------------------------------------------------------
# chart_timeframes_default (issue #235)
# ---------------------------------------------------------------------------


def test_patch_chart_timeframes_valid_list() -> None:
  """PATCH with a valid chart_timeframes_default list → 200, round-trips on GET."""
  tfs = [{"unit": "m", "value": 15}, {"unit": "h", "value": 4}, {"unit": "D", "value": 1}]
  with TestClient(app) as client:
    response = client.patch("/api/preferences", json={"chart_timeframes_default": tfs})
    assert response.status_code == 200
    assert response.json()["data"]["chart_timeframes_default"] == tfs

    reread = client.get("/api/preferences").json()["data"]
    assert reread["chart_timeframes_default"] == tfs


def test_patch_chart_timeframes_accepts_all_valid_units() -> None:
  """All four valid units (m, h, D, W) are accepted."""
  tfs = [
    {"unit": "m", "value": 1},
    {"unit": "h", "value": 1},
    {"unit": "D", "value": 1},
    {"unit": "W", "value": 1},
  ]
  with TestClient(app) as client:
    response = client.patch("/api/preferences", json={"chart_timeframes_default": tfs})
  assert response.status_code == 200
  assert response.json()["data"]["chart_timeframes_default"] == tfs


def test_patch_chart_timeframes_rejects_wrong_casing() -> None:
  """Wrong-casing units (d, w, M, H) are rejected with HTTP 400."""
  with TestClient(app) as client:
    for bad_unit in ("d", "w", "M", "H"):
      response = client.patch(
        "/api/preferences",
        json={"chart_timeframes_default": [{"unit": bad_unit, "value": 1}]},
      )
      assert response.status_code == 400, f"Expected 400 for unit={bad_unit!r}"
      assert response.json()["data"] is None


def test_patch_chart_timeframes_rejects_zero_value() -> None:
  """A timeframe value of 0 is rejected."""
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences",
      json={"chart_timeframes_default": [{"unit": "m", "value": 0}]},
    )
  assert response.status_code == 400
  assert response.json()["data"] is None


def test_patch_chart_timeframes_rejects_negative_value() -> None:
  """A negative timeframe value is rejected."""
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences",
      json={"chart_timeframes_default": [{"unit": "h", "value": -1}]},
    )
  assert response.status_code == 400
  assert response.json()["data"] is None


def test_patch_chart_timeframes_rejects_bool_value() -> None:
  """Boolean values are rejected even though bool is a subclass of int in Python."""
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences",
      json={"chart_timeframes_default": [{"unit": "m", "value": True}]},
    )
  assert response.status_code == 400
  assert response.json()["data"] is None


def test_patch_chart_timeframes_rejects_duplicates() -> None:
  """Duplicate (unit, value) pairs in chart_timeframes_default are rejected."""
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences",
      json={
        "chart_timeframes_default": [
          {"unit": "m", "value": 15},
          {"unit": "m", "value": 15},
        ]
      },
    )
  assert response.status_code == 400
  assert response.json()["data"] is None


# ---------------------------------------------------------------------------
# entry_timeframe_unit_default / entry_timeframe_value_default (issue #235)
# ---------------------------------------------------------------------------


def test_patch_entry_timeframe_both_together() -> None:
  """PATCH with both entry-timeframe fields → 200, round-trips on GET."""
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences",
      json={"entry_timeframe_unit_default": "h", "entry_timeframe_value_default": 4},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["entry_timeframe_unit_default"] == "h"
    assert data["entry_timeframe_value_default"] == 4

    reread = client.get("/api/preferences").json()["data"]
    assert reread["entry_timeframe_unit_default"] == "h"
    assert reread["entry_timeframe_value_default"] == 4


def test_patch_entry_timeframe_only_unit_fails() -> None:
  """Sending only entry_timeframe_unit_default without the value is rejected."""
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences",
      json={"entry_timeframe_unit_default": "h"},
    )
  assert response.status_code == 400
  assert response.json()["data"] is None


def test_patch_entry_timeframe_only_value_fails() -> None:
  """Sending only entry_timeframe_value_default without the unit is rejected."""
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences",
      json={"entry_timeframe_value_default": 4},
    )
  assert response.status_code == 400
  assert response.json()["data"] is None


def test_patch_entry_timeframe_clearing_both_null() -> None:
  """Sending both as null explicitly clears the entry-timeframe defaults."""
  with TestClient(app) as client:
    # First set them.
    client.patch(
      "/api/preferences",
      json={"entry_timeframe_unit_default": "D", "entry_timeframe_value_default": 1},
    )
    # Now clear them by sending explicit nulls.
    response = client.patch(
      "/api/preferences",
      json={"entry_timeframe_unit_default": None, "entry_timeframe_value_default": None},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["entry_timeframe_unit_default"] is None
    assert data["entry_timeframe_value_default"] is None

    reread = client.get("/api/preferences").json()["data"]
    assert reread["entry_timeframe_unit_default"] is None
    assert reread["entry_timeframe_value_default"] is None


def test_patch_entry_timeframe_invalid_unit_rejected() -> None:
  """An invalid entry_timeframe_unit_default is rejected even when paired."""
  with TestClient(app) as client:
    response = client.patch(
      "/api/preferences",
      json={"entry_timeframe_unit_default": "x", "entry_timeframe_value_default": 1},
    )
  assert response.status_code == 400
  assert response.json()["data"] is None


# ---------------------------------------------------------------------------
# Partial update — fields are independent (issue #235)
# ---------------------------------------------------------------------------


def test_patch_chart_timeframes_alone_leaves_entry_timeframe_unchanged() -> None:
  """Patching only chart_timeframes_default does not touch entry-timeframe fields."""
  with TestClient(app) as client:
    # Set the entry-timeframe pair first.
    client.patch(
      "/api/preferences",
      json={"entry_timeframe_unit_default": "W", "entry_timeframe_value_default": 1},
    )
    # Patch only chart_timeframes_default.
    response = client.patch(
      "/api/preferences",
      json={"chart_timeframes_default": [{"unit": "m", "value": 5}]},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["chart_timeframes_default"] == [{"unit": "m", "value": 5}]
    assert data["entry_timeframe_unit_default"] == "W"
    assert data["entry_timeframe_value_default"] == 1


def test_patch_entry_timeframe_alone_leaves_chart_timeframes_unchanged() -> None:
  """Patching only the entry-timeframe pair does not touch chart_timeframes_default."""
  tfs = [{"unit": "h", "value": 1}, {"unit": "D", "value": 1}]
  with TestClient(app) as client:
    client.patch("/api/preferences", json={"chart_timeframes_default": tfs})
    response = client.patch(
      "/api/preferences",
      json={"entry_timeframe_unit_default": "m", "entry_timeframe_value_default": 15},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["chart_timeframes_default"] == tfs
    assert data["entry_timeframe_unit_default"] == "m"
    assert data["entry_timeframe_value_default"] == 15
