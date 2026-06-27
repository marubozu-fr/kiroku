"""Tests for app.services.massive_service — Massive API client (issue #185)."""
import asyncio
import time
from typing import Any

import httpx
import pytest

from app.database import database, enable_foreign_keys
from app.services import massive_service

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


def test_allowed_markets_covers_all_supported_markets() -> None:
  assert massive_service.ALLOWED_MARKETS == ("fx", "stocks", "crypto", "indices")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def db() -> Any:
  """Connect the shared async database to the test DB for the duration of a test."""
  enable_foreign_keys()
  await database.connect()
  try:
    yield database
  finally:
    await database.disconnect()


@pytest.fixture(autouse=True)
def reset_call_times() -> Any:
  """Clear the rate-limiter state before every test to avoid cross-test pollution."""
  massive_service._call_times.clear()
  yield
  massive_service._call_times.clear()


# ---------------------------------------------------------------------------
# Fake HTTP client helpers
# ---------------------------------------------------------------------------


class _FakeResponse:
  """Minimal httpx response substitute."""

  def __init__(self, payload: dict[str, Any], status_code: int = 200) -> None:
    self._payload = payload
    self.status_code = status_code
    self.request = httpx.Request("GET", "https://api.massive.com/test")

  def raise_for_status(self) -> None:
    if self.status_code >= 400:
      response = httpx.Response(self.status_code, request=self.request)
      raise httpx.HTTPStatusError(
        f"HTTP {self.status_code}",
        request=self.request,
        response=response,
      )

  def json(self) -> dict[str, Any]:
    return self._payload


class _ErrorResponse:
  """Response that raises on raise_for_status."""

  def __init__(self, status_code: int) -> None:
    self.status_code = status_code
    self.request = httpx.Request("GET", "https://api.massive.com/test")

  def raise_for_status(self) -> None:
    response = httpx.Response(self.status_code, request=self.request)
    raise httpx.HTTPStatusError(
      f"HTTP {self.status_code}",
      request=self.request,
      response=response,
    )


class _FakeClient:
  """Configurable fake AsyncClient.

  responses_or_exceptions: consumed in order for each call to get().
  Each entry is either a _FakeResponse/_ErrorResponse (returned) or an
  exception class/instance (raised). Recorded calls are stored in `calls`
  as (url, params) tuples.
  """

  def __init__(
    self,
    responses_or_exceptions: list[Any],
    **kwargs: Any,
  ) -> None:
    self._queue = list(responses_or_exceptions)
    self.calls: list[tuple[str, dict[str, Any] | None]] = []

  async def __aenter__(self) -> "_FakeClient":
    return self

  async def __aexit__(self, *args: Any) -> None:
    return None

  async def get(self, url: str, params: dict[str, Any] | None = None) -> Any:
    self.calls.append((url, params))
    if not self._queue:
      raise AssertionError("_FakeClient: no more responses configured")
    entry = self._queue.pop(0)
    if isinstance(entry, BaseException):
      raise entry
    if isinstance(entry, type) and issubclass(entry, BaseException):
      raise entry("fake error")
    return entry


def _make_factory(
  responses_or_exceptions: list[Any],
) -> tuple[type, "_FakeClient"]:
  """Return (factory_class, shared_instance) so tests can inspect calls."""
  instance = _FakeClient(responses_or_exceptions)

  class _Factory:
    def __init__(self, **kwargs: Any) -> None:
      pass

    async def __aenter__(self) -> _FakeClient:
      return instance

    async def __aexit__(self, *args: Any) -> None:
      return None

  return _Factory, instance


# ---------------------------------------------------------------------------
# 1. Pure normalization — no DB, no HTTP
# ---------------------------------------------------------------------------


def test_normalize_forex_candle_keeps_ohlcvt_drops_extras() -> None:
  raw = {
    "o": 1.1,
    "h": 1.2,
    "l": 1.0,
    "c": 1.15,
    "v": 100,
    "t": 1700000000000,
    "n": 5,
    "vw": 1.12,
  }
  result = massive_service._normalize_forex_candle(raw)
  assert result == {"o": 1.1, "h": 1.2, "l": 1.0, "c": 1.15, "v": 100, "t": 1700000000000}
  # Extra keys must not appear.
  assert "n" not in result
  assert "vw" not in result


def test_normalize_forex_candle_t_is_int() -> None:
  raw = {"o": 1.1, "h": 1.2, "l": 1.0, "c": 1.15, "v": 100, "t": 1700000000000.0}
  result = massive_service._normalize_forex_candle(raw)
  assert isinstance(result["t"], int)
  assert result["t"] == 1700000000000


def test_normalize_futures_candle_maps_keys_and_converts_ns_to_ms() -> None:
  raw = {
    "open": 5000.0,
    "high": 5010.0,
    "low": 4990.0,
    "close": 5005.0,
    "volume": 1200,
    "window_start": 1700000000000000000,
    "transactions": 3,
  }
  result = massive_service._normalize_futures_candle(raw)
  assert result == {
    "o": 5000.0,
    "h": 5010.0,
    "l": 4990.0,
    "c": 5005.0,
    "v": 1200,
    "t": 1700000000000,
  }
  # transactions must not bleed through.
  assert "transactions" not in result


def test_normalize_futures_candle_t_is_ms_division() -> None:
  # 1_000_000 ns == 1 ms (the service divides window_start by 1_000_000).
  raw = {
    "open": 1.0,
    "high": 1.0,
    "low": 1.0,
    "close": 1.0,
    "volume": 0,
    "window_start": 1_000_000,
    "transactions": 0,
  }
  result = massive_service._normalize_futures_candle(raw)
  assert result["t"] == 1


# ---------------------------------------------------------------------------
# 2. No API key configured — no HTTP call must be made
# ---------------------------------------------------------------------------


async def test_search_tickers_returns_empty_without_api_key(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  # Arrange: key left as '' (conftest seeds it that way). Patch httpx so any
  # call raises immediately — proving no request is attempted.
  call_count = 0

  class _NeverCalled:
    def __init__(self, **kwargs: Any) -> None:
      nonlocal call_count
      call_count += 1

    async def __aenter__(self) -> "_NeverCalled":
      return self

    async def __aexit__(self, *args: Any) -> None:
      return None

    async def get(self, *args: Any, **kwargs: Any) -> None:
      raise AssertionError("HTTP must not be called when the API key is missing")

  monkeypatch.setattr(massive_service.httpx, "AsyncClient", _NeverCalled)

  result = await massive_service.search_tickers("EUR", "fx")

  assert result == []
  assert call_count == 0


async def test_fetch_candles_returns_empty_without_api_key(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  class _NeverCalled:
    def __init__(self, **kwargs: Any) -> None:
      pass

    async def __aenter__(self) -> "_NeverCalled":
      return self

    async def __aexit__(self, *args: Any) -> None:
      return None

    async def get(self, *args: Any, **kwargs: Any) -> None:
      raise AssertionError("HTTP must not be called when the API key is missing")

  monkeypatch.setattr(massive_service.httpx, "AsyncClient", _NeverCalled)

  result = await massive_service.fetch_candles("C:EURUSD", "2026-01-01", "2026-01-02")

  assert result == []


async def test_rate_limited_get_returns_none_without_api_key(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  class _NeverCalled:
    def __init__(self, **kwargs: Any) -> None:
      pass

    async def __aenter__(self) -> "_NeverCalled":
      return self

    async def __aexit__(self, *args: Any) -> None:
      return None

    async def get(self, *args: Any, **kwargs: Any) -> None:
      raise AssertionError("HTTP must not be called when the API key is missing")

  monkeypatch.setattr(massive_service.httpx, "AsyncClient", _NeverCalled)

  result = await massive_service._rate_limited_get("https://api.massive.com/test", {})

  assert result is None


# ---------------------------------------------------------------------------
# 3. Ticker search works for forex
# ---------------------------------------------------------------------------


async def test_search_tickers_forex_returns_results_and_hits_correct_url(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  # Arrange
  payload = {
    "results": [
      {
        "ticker": "C:EURUSD",
        "name": "Euro-US Dollar",
        "market": "fx",
        "locale": "global",
        "currency_name": "US Dollar",
        "active": True,
      }
    ]
  }
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  factory, instance = _make_factory([_FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  # Act
  result = await massive_service.search_tickers("EUR", "fx")

  # Assert
  assert result == payload["results"]
  assert len(instance.calls) == 1
  url_called, params_called = instance.calls[0]
  assert "/v3/reference/tickers" in url_called
  assert params_called is not None
  assert params_called["search"] == "EUR"
  assert params_called["market"] == "fx"
  assert params_called["active"] == "true"
  assert params_called["limit"] == 20
  assert params_called["apiKey"] == "test-key-123"


# ---------------------------------------------------------------------------
# 4. Candle fetch works for forex (C:EURUSD)
# ---------------------------------------------------------------------------


async def test_fetch_candles_forex_normalizes_and_hits_correct_url(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  payload = {
    "results": [
      {"o": 1.1, "h": 1.2, "l": 1.0, "c": 1.15, "v": 100, "t": 1700000000000, "n": 5, "vw": 1.12}
    ]
  }
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  factory, instance = _make_factory([_FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.fetch_candles("C:EURUSD", "2026-01-01", "2026-01-02")

  assert len(result) == 1
  candle = result[0]
  assert candle == {"o": 1.1, "h": 1.2, "l": 1.0, "c": 1.15, "v": 100, "t": 1700000000000}
  assert isinstance(candle["t"], int)

  url_called, _ = instance.calls[0]
  assert "/v2/aggs/ticker/C:EURUSD/range/1/minute/" in url_called


# ---------------------------------------------------------------------------
# 5. Candle fetch works for futures (ESU5)
# ---------------------------------------------------------------------------


async def test_fetch_candles_futures_normalizes_and_hits_correct_url(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  payload = {
    "results": [
      {
        "open": 5000.0,
        "high": 5010.0,
        "low": 4990.0,
        "close": 5005.0,
        "volume": 1200,
        "window_start": 1700000000000000000,
        "transactions": 7,
      }
    ]
  }
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  factory, instance = _make_factory([_FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.fetch_candles("ESU5", "2026-01-01", "2026-01-02")

  assert len(result) == 1
  candle = result[0]
  assert candle["t"] == 1700000000000
  assert candle["o"] == 5000.0
  assert candle["h"] == 5010.0
  assert candle["l"] == 4990.0
  assert candle["c"] == 5005.0
  assert candle["v"] == 1200

  url_called, _ = instance.calls[0]
  assert "/futures/v1/aggs/ESU5" in url_called


# ---------------------------------------------------------------------------
# 6. Rate limiter
# ---------------------------------------------------------------------------


async def test_rate_limiter_sleeps_when_five_recent_calls_exist(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  """With 5 call times all within the current window, sleep must be awaited."""
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  # Pre-fill _call_times with 5 very recent timestamps (all within the 60-s window).
  now = time.monotonic()
  massive_service._call_times.extend([now, now, now, now, now])

  sleep_durations: list[float] = []

  async def _fake_sleep(seconds: float) -> None:
    sleep_durations.append(seconds)

  monkeypatch.setattr(massive_service.asyncio, "sleep", _fake_sleep)

  payload = {"results": []}
  factory, _ = _make_factory([_FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  await massive_service._rate_limited_get("https://api.massive.com/v3/test", {})

  # At least one sleep must have been triggered by the rate limiter.
  assert len(sleep_durations) >= 1
  assert sleep_durations[0] > 0


async def test_rate_limiter_does_not_sleep_when_call_times_empty(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  """With no prior calls, sleep must NOT be triggered."""
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  sleep_durations: list[float] = []

  async def _fake_sleep(seconds: float) -> None:
    sleep_durations.append(seconds)

  monkeypatch.setattr(massive_service.asyncio, "sleep", _fake_sleep)

  payload = {"results": []}
  factory, _ = _make_factory([_FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  await massive_service._rate_limited_get("https://api.massive.com/v3/test", {})

  # The rate-limiter sleep must not have fired (429-retry sleep is also absent
  # because the fake response succeeds, so the list must stay empty).
  assert sleep_durations == []


async def test_rate_limiter_does_not_sleep_when_fewer_than_five_calls(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  """With only 4 recent calls, sleep must NOT be triggered."""
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  now = time.monotonic()
  massive_service._call_times.extend([now, now, now, now])  # 4 calls — under the limit

  sleep_durations: list[float] = []

  async def _fake_sleep(seconds: float) -> None:
    sleep_durations.append(seconds)

  monkeypatch.setattr(massive_service.asyncio, "sleep", _fake_sleep)

  payload = {"results": []}
  factory, _ = _make_factory([_FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  await massive_service._rate_limited_get("https://api.massive.com/v3/test", {})

  assert sleep_durations == []


async def test_rate_limiter_prunes_old_timestamps_and_does_not_sleep(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  """Timestamps older than 60 s must be pruned; pruned-only => no sleep."""
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  # Fix monotonic to a known value so we can place timestamps cleanly outside
  # the 60-second window.
  fixed_now = 1_000_000.0

  def _fake_monotonic() -> float:
    return fixed_now

  monkeypatch.setattr(massive_service.time, "monotonic", _fake_monotonic)

  # 5 old timestamps all older than 60 s (cutoff = fixed_now - 60 = 999940).
  old = fixed_now - 61.0
  massive_service._call_times.extend([old, old, old, old, old])

  sleep_durations: list[float] = []

  async def _fake_sleep(seconds: float) -> None:
    sleep_durations.append(seconds)

  monkeypatch.setattr(massive_service.asyncio, "sleep", _fake_sleep)

  payload = {"results": []}
  factory, _ = _make_factory([_FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  await massive_service._rate_limited_get("https://api.massive.com/v3/test", {})

  # All 5 old timestamps must have been pruned, so no rate-limit sleep fires.
  assert sleep_durations == []


async def test_rate_limiter_blocks_sixth_concurrent_call(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  """Six concurrent calls: the first 5 reserve slots, the 6th must wait.

  Each call records its timestamp *before* issuing the HTTP request, so a
  concurrent coroutine sees the slot as taken instead of all six rushing past
  the limiter at once. The HTTP get blocks on an event, so every coroutine
  reaches the rate-limit check before any request completes.
  """
  # Capture the real sleep before the limiter's sleep is patched out, so we
  # can still pump the event loop deterministically.
  real_sleep = asyncio.sleep

  async def _fake_get_key() -> str:
    return "test-key-123"

  monkeypatch.setattr(massive_service, "_get_api_key", _fake_get_key)

  sleep_durations: list[float] = []

  async def _fake_sleep(seconds: float) -> None:
    # Return immediately so the rate-limited 6th coroutine can proceed.
    sleep_durations.append(seconds)

  monkeypatch.setattr(massive_service.asyncio, "sleep", _fake_sleep)

  release = asyncio.Event()

  class _BlockingClient:
    def __init__(self, **kwargs: Any) -> None:
      pass

    async def __aenter__(self) -> "_BlockingClient":
      return self

    async def __aexit__(self, *args: Any) -> None:
      return None

    async def get(self, url: str, params: dict[str, Any] | None = None) -> Any:
      await release.wait()
      return _FakeResponse({"results": []})

  monkeypatch.setattr(massive_service.httpx, "AsyncClient", _BlockingClient)

  tasks = [
    asyncio.ensure_future(
      massive_service._rate_limited_get("https://api.massive.com/v3/test", {})
    )
    for _ in range(6)
  ]

  # Pump the loop so every coroutine advances to either the blocking HTTP get
  # (first 5) or the rate-limit sleep (the 6th).
  for _ in range(20):
    await real_sleep(0)

  # The 6th call hit the limiter and had to wait.
  assert len(sleep_durations) == 1
  assert sleep_durations[0] > 0

  # Release the blocked requests and let every call finish.
  release.set()
  results = await asyncio.gather(*tasks)
  assert all(r == {"results": []} for r in results)


# ---------------------------------------------------------------------------
# 7. Graceful network error
# ---------------------------------------------------------------------------


async def test_rate_limited_get_returns_none_on_connect_error(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  factory, _ = _make_factory([httpx.ConnectError("boom")])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service._rate_limited_get("https://api.massive.com/v3/test", {})

  assert result is None


async def test_search_tickers_returns_empty_on_network_error(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  factory, _ = _make_factory([httpx.ConnectError("boom")])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.search_tickers("EUR", "fx")

  assert result == []


async def test_fetch_candles_returns_empty_on_network_error(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  factory, _ = _make_factory([httpx.ConnectError("boom")])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.fetch_candles("C:EURUSD", "2026-01-01", "2026-01-02")

  assert result == []


# ---------------------------------------------------------------------------
# 8. 401/403 invalid key
# ---------------------------------------------------------------------------


async def test_rate_limited_get_returns_none_on_401(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "bad-key"},
  )

  factory, _ = _make_factory([_ErrorResponse(401)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service._rate_limited_get("https://api.massive.com/v3/test", {})

  assert result is None


async def test_rate_limited_get_returns_none_on_403(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "bad-key"},
  )

  factory, _ = _make_factory([_ErrorResponse(403)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service._rate_limited_get("https://api.massive.com/v3/test", {})

  assert result is None


async def test_search_tickers_returns_empty_on_401(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "bad-key"},
  )

  factory, _ = _make_factory([_ErrorResponse(401)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.search_tickers("EUR", "fx")

  assert result == []


# ---------------------------------------------------------------------------
# 9. 429 retry
# ---------------------------------------------------------------------------


async def test_rate_limited_get_retries_on_429_and_succeeds(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  """First call 429, second succeeds — result must be the successful payload."""
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  sleep_durations: list[float] = []

  async def _fake_sleep(seconds: float) -> None:
    sleep_durations.append(seconds)

  monkeypatch.setattr(massive_service.asyncio, "sleep", _fake_sleep)

  payload = {"results": [{"ticker": "C:EURUSD"}]}

  # First: 429 error response, second: successful response.
  factory, instance = _make_factory([_ErrorResponse(429), _FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service._rate_limited_get("https://api.massive.com/v3/test", {})

  assert result == payload
  # Must have slept for the retry delay.
  assert any(d == massive_service.RETRY_DELAY_SECONDS for d in sleep_durations)
  # Two HTTP calls must have been made (first 429, then retry).
  assert len(instance.calls) == 2


async def test_rate_limited_get_returns_none_when_both_attempts_429(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  """Both attempts 429 => None returned."""
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  async def _fake_sleep(seconds: float) -> None:
    pass

  monkeypatch.setattr(massive_service.asyncio, "sleep", _fake_sleep)

  factory, instance = _make_factory([_ErrorResponse(429), _ErrorResponse(429)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service._rate_limited_get("https://api.massive.com/v3/test", {})

  assert result is None
  assert len(instance.calls) == 2


async def test_search_tickers_returns_results_after_429_retry(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  """search_tickers propagates the retried success correctly."""
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  async def _fake_sleep(seconds: float) -> None:
    pass

  monkeypatch.setattr(massive_service.asyncio, "sleep", _fake_sleep)

  ticker_result = [
    {"ticker": "C:EURUSD", "name": "Euro-US Dollar", "market": "fx", "locale": "global",
     "currency_name": "US Dollar", "active": True}
  ]
  payload = {"results": ticker_result}

  factory, _ = _make_factory([_ErrorResponse(429), _FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.search_tickers("EUR", "fx")

  assert result == ticker_result


async def test_fetch_candles_returns_empty_when_both_attempts_429(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  async def _fake_sleep(seconds: float) -> None:
    pass

  monkeypatch.setattr(massive_service.asyncio, "sleep", _fake_sleep)

  factory, _ = _make_factory([_ErrorResponse(429), _ErrorResponse(429)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.fetch_candles("C:EURUSD", "2026-01-01", "2026-01-02")

  assert result == []


# ---------------------------------------------------------------------------
# 10. Futures contracts lookup (issue #208)
# ---------------------------------------------------------------------------


async def test_fetch_contracts_returns_results_and_hits_correct_url(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  payload = {
    "results": [
      {"ticker": "NQH26", "first_trade_date": "2026-03-09", "last_trade_date": "2026-03-20"}
    ]
  }
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  factory, instance = _make_factory([_FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.fetch_contracts("NQ", "2026-03-15")

  assert result == payload["results"]
  url_called, params_called = instance.calls[0]
  assert "/futures/v1/contracts" in url_called
  assert params_called is not None
  assert params_called["product_code"] == "NQ"
  assert params_called["date"] == "2026-03-15"
  assert params_called["active"] == "true"


async def test_fetch_contracts_accepts_bare_array_payload(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  payload = [
    {"ticker": "ESH26", "first_trade_date": "2026-03-09", "last_trade_date": "2026-03-20"}
  ]
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  factory, _ = _make_factory([_FakeResponse(payload)])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.fetch_contracts("ES", "2026-03-15")

  assert result == payload


async def test_fetch_contracts_returns_empty_without_api_key(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  class _NeverCalled:
    def __init__(self, **kwargs: Any) -> None:
      pass

    async def __aenter__(self) -> "_NeverCalled":
      return self

    async def __aexit__(self, *args: Any) -> None:
      return None

    async def get(self, *args: Any, **kwargs: Any) -> None:
      raise AssertionError("HTTP must not be called when the API key is missing")

  monkeypatch.setattr(massive_service.httpx, "AsyncClient", _NeverCalled)

  result = await massive_service.fetch_contracts("NQ", "2026-03-15")

  assert result == []


async def test_fetch_contracts_returns_empty_on_network_error(
  db: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
  await database.execute(
    "UPDATE user_preferences SET massive_api_key = :k WHERE id = 1",
    {"k": "test-key-123"},
  )

  factory, _ = _make_factory([httpx.ConnectError("boom")])
  monkeypatch.setattr(massive_service.httpx, "AsyncClient", factory)

  result = await massive_service.fetch_contracts("NQ", "2026-03-15")

  assert result == []
