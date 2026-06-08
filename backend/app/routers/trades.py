from typing import Optional

from fastapi import APIRouter

from app.models.response import ApiResponse
from app.models.trade import (
  TradeCreate,
  TradeDirection,
  TradeResponse,
  TradeStatus,
  TradeSummary,
  TradeUpdate,
)
from app.services import trade_service

router = APIRouter(prefix="/api/trades", tags=["trades"])


@router.get("")
async def list_trades(
  year: Optional[int] = None,
  asset_id: Optional[int] = None,
  status: Optional[TradeStatus] = None,
  direction: Optional[TradeDirection] = None,
) -> ApiResponse[list[TradeSummary]]:
  trades = await trade_service.list_trades(
    year=year,
    asset_id=asset_id,
    status=status.value if status is not None else None,
    direction=direction.value if direction is not None else None,
  )
  return ApiResponse(data=[TradeSummary(**trade) for trade in trades])


@router.get("/years")
async def list_years() -> ApiResponse[list[int]]:
  years = await trade_service.list_years()
  return ApiResponse(data=years)


@router.get("/{trade_id}")
async def get_trade(trade_id: int) -> ApiResponse[TradeResponse]:
  trade = await trade_service.get_trade(trade_id)
  return ApiResponse(data=TradeResponse(**trade))


@router.post("", status_code=201)
async def create_trade(payload: TradeCreate) -> ApiResponse[TradeResponse]:
  trade = await trade_service.create_trade(payload)
  return ApiResponse(data=TradeResponse(**trade))


@router.put("/{trade_id}")
async def update_trade(trade_id: int, payload: TradeUpdate) -> ApiResponse[TradeResponse]:
  trade = await trade_service.update_trade(trade_id, payload)
  return ApiResponse(data=TradeResponse(**trade))


@router.delete("/{trade_id}")
async def delete_trade(trade_id: int) -> ApiResponse[TradeResponse]:
  trade = await trade_service.delete_trade(trade_id)
  return ApiResponse(data=TradeResponse(**trade))
