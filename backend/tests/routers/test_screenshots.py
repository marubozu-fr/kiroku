from fastapi.testclient import TestClient

from app.database import SCREENSHOTS_DIR
from app.main import app

# A tiny but real PNG (1x1 transparent pixel). Content is never decoded by the
# API — validation is by declared content type — but using genuine bytes keeps
# the round-trip (upload -> serve) honest.
_PNG_BYTES = bytes.fromhex(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
  "890000000a49444154789c6360000002000154a24f6f0000000049454e44ae426082"
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _create_asset(client: TestClient, name: str = "EURUSD", category: str = "Forex") -> int:
  resp = client.post("/api/assets", json={"name": name, "category": category})
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _create_trade(client: TestClient) -> int:
  asset_id = _create_asset(client)
  resp = client.post(
    "/api/trades",
    json={
      "asset_id": asset_id,
      "activities": [{"type": "Buy", "price": 1.10, "quantity": 1.0, "date": "2024-03-15"}],
    },
  )
  assert resp.status_code == 201, resp.text
  return resp.json()["data"]["id"]


def _upload(
  client: TestClient,
  trade_id: int,
  *,
  filename: str = "chart.png",
  content: bytes = _PNG_BYTES,
  content_type: str = "image/png",
  data: dict | None = None,
):
  return client.post(
    f"/api/trades/{trade_id}/screenshots",
    files={"file": (filename, content, content_type)},
    data=data or {},
  )


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------


def test_upload_screenshot_happy_path() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    response = _upload(
      client,
      trade_id,
      data={"timeframe_unit": "Minute", "timeframe_value": "15"},
    )

  assert response.status_code == 201, response.text
  body = response.json()
  assert body["error"] is None
  data = body["data"]
  assert data["id"] > 0
  assert data["trade_id"] == trade_id
  assert data["timeframe_unit"] == "Minute"
  assert data["timeframe_value"] == 15
  assert data["created_at"] is not None
  # Stored filename is generated, ends in the content-type extension, and
  # carries no path components.
  assert data["filename"].endswith(".png")
  assert "/" not in data["filename"] and ".." not in data["filename"]


def test_upload_without_timeframe() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    response = _upload(client, trade_id)

  assert response.status_code == 201, response.text
  data = response.json()["data"]
  assert data["timeframe_unit"] is None
  assert data["timeframe_value"] is None


def test_upload_accepts_jpeg_and_webp() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    jpg = _upload(client, trade_id, filename="c.jpg", content_type="image/jpeg")
    webp = _upload(client, trade_id, filename="c.webp", content_type="image/webp")

  assert jpg.status_code == 201, jpg.text
  assert jpg.json()["data"]["filename"].endswith(".jpg")
  assert webp.status_code == 201, webp.text
  assert webp.json()["data"]["filename"].endswith(".webp")


def test_upload_appears_in_trade_detail_and_list() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    _upload(client, trade_id)

    list_resp = client.get(f"/api/trades/{trade_id}/screenshots")
    detail_resp = client.get(f"/api/trades/{trade_id}")

  assert list_resp.status_code == 200
  assert len(list_resp.json()["data"]) == 1
  assert detail_resp.status_code == 200
  assert len(detail_resp.json()["data"]["screenshots"]) == 1


def test_upload_to_missing_trade_returns_404() -> None:
  with TestClient(app) as client:
    response = _upload(client, 9999)

  assert response.status_code == 404
  assert response.json()["data"] is None


def test_upload_rejects_unsupported_type() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    pdf = _upload(client, trade_id, filename="x.pdf", content=b"%PDF-1.4", content_type="application/pdf")
    gif = _upload(client, trade_id, filename="x.gif", content=b"GIF89a", content_type="image/gif")

  assert pdf.status_code == 400
  assert "type" in pdf.json()["error"].lower()
  assert gif.status_code == 400


def test_upload_rejects_oversized_file() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    oversized = b"\x89PNG" + b"0" * (5 * 1024 * 1024 + 1)
    response = _upload(client, trade_id, content=oversized)

  assert response.status_code == 400
  assert "5mb" in response.json()["error"].lower()


def test_upload_rejects_empty_file() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    response = _upload(client, trade_id, content=b"")

  assert response.status_code == 400


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


def test_list_screenshots_for_missing_trade_returns_404() -> None:
  with TestClient(app) as client:
    response = client.get("/api/trades/9999/screenshots")

  assert response.status_code == 404


def test_list_screenshots_empty() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    response = client.get(f"/api/trades/{trade_id}/screenshots")

  assert response.status_code == 200
  assert response.json()["data"] == []


# ---------------------------------------------------------------------------
# Serve
# ---------------------------------------------------------------------------


def test_serve_screenshot_returns_file() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    filename = _upload(client, trade_id).json()["data"]["filename"]
    response = client.get(f"/api/screenshots/{filename}")

  assert response.status_code == 200
  assert response.headers["content-type"] == "image/png"
  assert response.content == _PNG_BYTES


def test_serve_unknown_filename_returns_404() -> None:
  with TestClient(app) as client:
    response = client.get("/api/screenshots/does-not-exist.png")

  assert response.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


def test_delete_screenshot_removes_record_and_file() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    created = _upload(client, trade_id).json()["data"]
    screenshot_id = created["id"]
    stored_path = SCREENSHOTS_DIR / str(trade_id) / created["filename"]
    assert stored_path.is_file()

    response = client.delete(f"/api/screenshots/{screenshot_id}")

    assert response.status_code == 200
    assert response.json()["data"]["id"] == screenshot_id
    assert not stored_path.exists()

    # Gone from the trade's list and no longer servable.
    assert client.get(f"/api/trades/{trade_id}/screenshots").json()["data"] == []
    assert client.get(f"/api/screenshots/{created['filename']}").status_code == 404


def test_delete_missing_screenshot_returns_404() -> None:
  with TestClient(app) as client:
    response = client.delete("/api/screenshots/9999")

  assert response.status_code == 404


def test_delete_trade_cascades_screenshot_records() -> None:
  with TestClient(app) as client:
    trade_id = _create_trade(client)
    filename = _upload(client, trade_id).json()["data"]["filename"]
    stored_path = SCREENSHOTS_DIR / str(trade_id) / filename
    assert stored_path.is_file()

    assert client.delete(f"/api/trades/{trade_id}").status_code == 200
    # The DB row is gone (FK cascade), so the file is no longer servable.
    assert client.get(f"/api/screenshots/{filename}").status_code == 404
    # The screenshot file is also removed from disk.
    assert not stored_path.exists()
