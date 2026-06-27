"""Tests for app.services.futures_service — contract resolution (issue #208)."""
from datetime import date
from typing import Any

import pytest

from app.errors import FuturesResolutionError
from app.services import futures_service
from app.services.futures_service import resolve_contract

# All 12 CME futures the acceptance criteria require resolution for.
CME_PRODUCTS = (
  "NQ", "ES", "YM", "RTY", "MNQ", "MES", "MYM", "M2K", "GC", "MGC", "SI", "SIL",
)


def _contract(
  ticker: str, first: str, last: str, contract_type: str = "single"
) -> dict[str, Any]:
  """Build a minimal Massive contract dict."""
  return {
    "ticker": ticker,
    "first_trade_date": first,
    "last_trade_date": last,
    "type": contract_type,
  }


def _patch_contracts(
  monkeypatch: pytest.MonkeyPatch, contracts: list[dict]
) -> list[tuple[str, str]]:
  """Stub massive_service.fetch_contracts; return a list recording its calls."""
  calls: list[tuple[str, str]] = []

  async def _fake_fetch_contracts(product_code: str, date_str: str) -> list[dict]:
    calls.append((product_code, date_str))
    return contracts

  monkeypatch.setattr(futures_service.massive_service, "fetch_contracts", _fake_fetch_contracts)
  return calls


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


async def test_resolve_contract_returns_active_ticker(monkeypatch: pytest.MonkeyPatch) -> None:
  calls = _patch_contracts(
    monkeypatch, [_contract("NQH26", "2026-03-09", "2026-03-20")]
  )

  ticker = await resolve_contract("NQ", date(2026, 3, 15))

  assert ticker == "NQH26"
  # Product code and ISO date are passed straight through to the API client.
  assert calls == [("NQ", "2026-03-15")]


@pytest.mark.parametrize("product", CME_PRODUCTS)
async def test_resolve_contract_works_for_all_cme_products(
  product: str, monkeypatch: pytest.MonkeyPatch
) -> None:
  expected = f"{product}H26"
  _patch_contracts(monkeypatch, [_contract(expected, "2026-03-09", "2026-03-20")])

  ticker = await resolve_contract(product, date(2026, 3, 15))

  assert ticker == expected


async def test_resolve_contract_uppercases_and_strips_base_symbol(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  calls = _patch_contracts(
    monkeypatch, [_contract("ESH26", "2026-03-09", "2026-03-20")]
  )

  ticker = await resolve_contract("  es  ", date(2026, 3, 15))

  assert ticker == "ESH26"
  assert calls == [("ES", "2026-03-15")]


# ---------------------------------------------------------------------------
# Edge cases — trading-window boundaries
# ---------------------------------------------------------------------------


async def test_resolve_contract_includes_first_trade_date(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  _patch_contracts(monkeypatch, [_contract("NQH26", "2026-03-09", "2026-03-20")])

  ticker = await resolve_contract("NQ", date(2026, 3, 9))

  assert ticker == "NQH26"


async def test_resolve_contract_includes_last_trade_date(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  _patch_contracts(monkeypatch, [_contract("NQH26", "2026-03-09", "2026-03-20")])

  ticker = await resolve_contract("NQ", date(2026, 3, 20))

  assert ticker == "NQH26"


async def test_resolve_contract_picks_front_month_when_multiple_overlap(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  # Two contracts cover 2026-03-15; the front month (earliest expiry) wins.
  _patch_contracts(
    monkeypatch,
    [
      _contract("NQM26", "2026-03-09", "2026-06-19"),
      _contract("NQH26", "2026-01-01", "2026-03-20"),
    ],
  )

  ticker = await resolve_contract("NQ", date(2026, 3, 15))

  assert ticker == "NQH26"


async def test_resolve_contract_skips_combo_contracts(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  # A combo (spread) has an earlier last_trade_date and would win the
  # front-month sort, but only the actual single contract must be selected.
  _patch_contracts(
    monkeypatch,
    [
      _contract("YM:BF U6-Z6-H7", "2026-01-01", "2026-03-12", contract_type="combo"),
      _contract("YMH26", "2026-01-01", "2026-03-20"),
    ],
  )

  ticker = await resolve_contract("YM", date(2026, 3, 15))

  assert ticker == "YMH26"


async def test_resolve_contract_raises_when_only_combos_cover_date(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  # With no single contract covering the date, resolution must fail rather
  # than fall back to a spread ticker.
  _patch_contracts(
    monkeypatch,
    [_contract("YM:BF U6-Z6-H7", "2026-01-01", "2026-03-20", contract_type="combo")],
  )

  with pytest.raises(FuturesResolutionError, match="covers"):
    await resolve_contract("YM", date(2026, 3, 15))


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


async def test_resolve_contract_raises_when_product_not_found(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  _patch_contracts(monkeypatch, [])

  with pytest.raises(FuturesResolutionError, match="No active contract"):
    await resolve_contract("ZZ", date(2026, 3, 15))


async def test_resolve_contract_raises_when_no_contract_covers_date(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  # The API returned a contract, but its window does not contain the date.
  _patch_contracts(monkeypatch, [_contract("NQH26", "2026-03-09", "2026-03-20")])

  with pytest.raises(FuturesResolutionError, match="covers"):
    await resolve_contract("NQ", date(2026, 4, 1))


async def test_resolve_contract_raises_on_empty_base_symbol(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  with pytest.raises(FuturesResolutionError, match="empty"):
    await resolve_contract("   ", date(2026, 3, 15))


async def test_resolve_contract_skips_contracts_with_malformed_dates(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  _patch_contracts(
    monkeypatch,
    [
      _contract("NQBAD", "not-a-date", "2026-03-20"),
      _contract("NQH26", "2026-03-09", "2026-03-20"),
    ],
  )

  ticker = await resolve_contract("NQ", date(2026, 3, 15))

  assert ticker == "NQH26"


async def test_resolve_contract_raises_when_contract_has_no_ticker(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  _patch_contracts(
    monkeypatch,
    [{"first_trade_date": "2026-03-09", "last_trade_date": "2026-03-20"}],
  )

  with pytest.raises(FuturesResolutionError, match="no ticker"):
    await resolve_contract("NQ", date(2026, 3, 15))
