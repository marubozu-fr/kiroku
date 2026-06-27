import asyncio
import logging
import time

import httpx

from app.repositories import preferences_repository

logger = logging.getLogger(__name__)

MASSIVE_BASE_URL = "https://api.massive.com"
REQUEST_TIMEOUT_SECONDS = 30.0

# Markets the Massive reference search accepts.
ALLOWED_MARKETS = ("fx", "stocks", "crypto", "indices")

# Rate limiter: free tier allows 5 calls per 60-second sliding window.
MAX_CALLS_PER_MINUTE = 5
RATE_WINDOW_SECONDS = 60

# 429 retry delay in seconds. One retry only.
RETRY_DELAY_SECONDS = 5.0

# Module-level list of monotonic timestamps for recent API calls.
# Tests can clear this directly to reset state between runs.
_call_times: list[float] = []


async def _get_api_key() -> str:
  """Return the Massive API key from user preferences, or '' if not set."""
  prefs = await preferences_repository.get()
  return prefs.get("massive_api_key", "") or ""


async def _await_rate_limit_slot() -> None:
  """Block until a call slot is free under the sliding-window rate limit.

  Drops timestamps older than RATE_WINDOW_SECONDS, then sleeps until the
  oldest of MAX_CALLS_PER_MINUTE recorded calls leaves the window.
  """
  cutoff = time.monotonic() - RATE_WINDOW_SECONDS
  while _call_times and _call_times[0] <= cutoff:
    _call_times.pop(0)

  if len(_call_times) >= MAX_CALLS_PER_MINUTE:
    oldest = _call_times[0]
    sleep_for = (oldest + RATE_WINDOW_SECONDS) - time.monotonic()
    if sleep_for > 0:
      logger.debug("Rate limit reached; sleeping %.2f s", sleep_for)
      await asyncio.sleep(sleep_for)


async def _rate_limited_get(url: str, params: dict) -> dict | None:
  """Perform a rate-limited GET request with the API key injected.

  Enforces a sliding-window limit of MAX_CALLS_PER_MINUTE calls per
  RATE_WINDOW_SECONDS, and retries once after a delay on HTTP 429.
  Returns the parsed JSON dict on success, or None on error / missing key.
  """
  api_key = await _get_api_key()
  if not api_key:
    logger.info("Massive API key not configured; skipping request to %s", url)
    return None

  full_params = {**params, "apiKey": api_key}

  # Two attempts at most: the second covers a single retry after a 429.
  for attempt in range(2):
    await _await_rate_limit_slot()
    # Record the call before issuing it so concurrent coroutines see the slot
    # as taken and don't all rush past the limit at once. The provider counts
    # failed calls too, so leaving the timestamp on error is conservative but
    # correct.
    _call_times.append(time.monotonic())
    try:
      async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.get(url, params=full_params)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
      status = exc.response.status_code
      if status == 429 and attempt == 0:
        logger.warning(
          "Massive API rate limited (HTTP 429); retrying once after %.1f s",
          RETRY_DELAY_SECONDS,
        )
        await asyncio.sleep(RETRY_DELAY_SECONDS)
        continue
      if status in (401, 403):
        logger.error("Invalid Massive API key (HTTP %d) for %s", status, url)
      else:
        logger.warning("Massive API HTTP error %d for %s", status, url)
      return None
    except httpx.HTTPError as exc:
      logger.warning("Massive API network error for %s: %s", url, exc)
      return None

  return None


def _normalize_forex_candle(raw: dict) -> dict:
  """Map a forex aggregate candle to the uniform candle shape."""
  return {
    "o": raw["o"],
    "h": raw["h"],
    "l": raw["l"],
    "c": raw["c"],
    "v": raw["v"],
    "t": int(raw["t"]),
  }


def _normalize_futures_candle(raw: dict) -> dict:
  """Map a futures aggregate candle to the uniform candle shape.

  window_start is in Unix nanoseconds; convert to milliseconds.
  """
  return {
    "o": raw["open"],
    "h": raw["high"],
    "l": raw["low"],
    "c": raw["close"],
    "v": raw["volume"],
    "t": int(raw["window_start"]) // 1_000_000,
  }


async def search_tickers(query: str, market: str) -> list[dict]:
  """Search Massive tickers by keyword and market.

  market must be one of: 'fx', 'stocks', 'crypto', 'indices'.
  Returns a list of dicts with keys: ticker, name, market, locale,
  currency_name, active. Returns [] if the API key is missing or the
  request fails.
  """
  url = f"{MASSIVE_BASE_URL}/v3/reference/tickers"
  params = {
    "search": query,
    "market": market,
    "active": "true",
    "limit": 20,
  }
  data = await _rate_limited_get(url, params)
  if data is None:
    return []
  return data.get("results", [])


async def fetch_contracts(product_code: str, trade_date: str) -> list[dict]:
  """Fetch active futures contracts for a product on a point-in-time date.

  Queries the Massive Contracts API:
    GET /futures/v1/contracts?product_code=<code>&date=<YYYY-MM-DD>&active=true

  Each contract dict carries at least: ticker, first_trade_date,
  last_trade_date. Returns [] if the API key is missing or the request fails.
  """
  url = f"{MASSIVE_BASE_URL}/futures/v1/contracts"
  params = {
    "product_code": product_code,
    "date": trade_date,
    "active": "true",
  }
  data = await _rate_limited_get(url, params)
  if data is None:
    return []
  # The endpoint may return a bare array or the usual {"results": [...]} envelope.
  if isinstance(data, list):
    return data
  return data.get("results", [])


async def fetch_candles(ticker: str, date_from: str, date_to: str) -> list[dict]:
  """Fetch 1-minute OHLCV candles for a ticker between two dates.

  Ticker format determines the data source:
  - Forex: starts with 'C:' (e.g. 'C:EURUSD')
  - Futures: everything else (e.g. 'ESU5')

  Both sources return candles normalized to:
    {"o": float, "h": float, "l": float, "c": float, "v": float, "t": int}
  where t is Unix milliseconds.

  Returns [] if the API key is missing or the request fails.
  """
  is_forex = ticker.startswith("C:")

  if is_forex:
    url = f"{MASSIVE_BASE_URL}/v2/aggs/ticker/{ticker}/range/1/minute/{date_from}/{date_to}"
    params: dict = {"limit": 50000, "sort": "asc"}
    data = await _rate_limited_get(url, params)
    if data is None:
      return []
    raw_candles = data.get("results", [])
    return [_normalize_forex_candle(c) for c in raw_candles]
  else:
    url = f"{MASSIVE_BASE_URL}/futures/v1/aggs/{ticker}"
    params = {
      "resolution": "1min",
      "window_start.gte": date_from,
      "window_start.lte": date_to,
      "limit": 50000,
      "sort": "window_start.asc",
    }
    data = await _rate_limited_get(url, params)
    if data is None:
      return []
    raw_candles = data.get("results", [])
    return [_normalize_futures_candle(c) for c in raw_candles]
