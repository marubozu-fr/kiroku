"""Futures contract resolution service (issue #208).

Futures assets are linked to a base product code (e.g. NQ, ES, GC). The active
contract for a given trade date is resolved at request time through the Massive
Contracts API, removing the need for any hardcoded expiration calendar.
"""
import logging
from datetime import date

from app.errors import FuturesResolutionError
from app.services import massive_service

logger = logging.getLogger(__name__)


async def resolve_contract(base_symbol: str, trade_date: date) -> str:
  """Return the active contract ticker for *base_symbol* on *trade_date*.

  Args:
    base_symbol: Massive product code, e.g. "NQ", "ES", "GC".
    trade_date:  The date the contract must be active on.

  Returns:
    The contract ticker active on *trade_date*, e.g. "NQH26".

  Raises:
    FuturesResolutionError: when the product is unknown or no contract is
      active on *trade_date*.
  """
  product_code = base_symbol.strip().upper()
  if not product_code:
    raise FuturesResolutionError("Futures base symbol is empty")

  date_str = trade_date.isoformat()
  contracts = await massive_service.fetch_contracts(product_code, date_str)
  if not contracts:
    raise FuturesResolutionError(
      f"No active contract found for product '{product_code}' on {date_str}"
    )

  contract = _select_active_contract(contracts, trade_date)
  if contract is None:
    raise FuturesResolutionError(
      f"No contract for '{product_code}' covers {date_str}"
    )

  ticker = contract.get("ticker")
  if not ticker:
    raise FuturesResolutionError(
      f"Resolved contract for '{product_code}' on {date_str} has no ticker"
    )

  logger.debug("Resolved %s on %s -> %s", product_code, date_str, ticker)
  return ticker


def _select_active_contract(contracts: list[dict], trade_date: date) -> dict | None:
  """Pick the contract whose trading window contains *trade_date*.

  A contract is eligible when first_trade_date <= trade_date <= last_trade_date
  (bounds inclusive). When several qualify, the front month — the one expiring
  soonest — is returned. Contracts with malformed or missing dates are skipped.
  """
  eligible: list[tuple[date, dict]] = []
  for contract in contracts:
    first = _parse_iso_date(contract.get("first_trade_date"))
    last = _parse_iso_date(contract.get("last_trade_date"))
    if first is None or last is None:
      continue
    if first <= trade_date <= last:
      eligible.append((last, contract))

  if not eligible:
    return None

  # Front month = earliest last_trade_date among the eligible contracts.
  eligible.sort(key=lambda item: item[0])
  return eligible[0][1]


def _parse_iso_date(value: object) -> date | None:
  """Parse an ISO 'YYYY-MM-DD' string into a date, or None when invalid."""
  if not isinstance(value, str):
    return None
  try:
    return date.fromisoformat(value)
  except ValueError:
    return None
