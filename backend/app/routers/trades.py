from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from app.models.candle import TradeCandlesResponse
from app.models.response import ApiResponse
from app.models.trade import (
  TradeCreate,
  TradeDirection,
  TradeResponse,
  TradeScreenshotResponse,
  TradeStatus,
  TradeSummary,
  TradeUpdate,
  YearStatistics,
)
from app.services import chart_service, screenshot_service, trade_service

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


@router.get("/statistics/{year}")
async def get_year_statistics(year: int) -> ApiResponse[YearStatistics]:
  stats = await trade_service.calculate_year_statistics(year)
  return ApiResponse(data=YearStatistics(**stats))


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


@router.post("/{trade_id}/screenshots", status_code=201)
async def upload_screenshot(
  trade_id: int,
  file: UploadFile = File(...),
  timeframe_unit: str = Form(...),
  timeframe_value: int = Form(...),
  label: Optional[str] = Form(default=None),
) -> ApiResponse[TradeScreenshotResponse]:
  screenshot = await screenshot_service.upload_screenshot(
    trade_id, file, timeframe_unit, timeframe_value, label
  )
  return ApiResponse(data=TradeScreenshotResponse(**screenshot))


@router.get("/{trade_id}/candles")
async def get_trade_candles(
  trade_id: int, resolution: Optional[str] = None
) -> TradeCandlesResponse:
  result = await chart_service.get_trade_candles(trade_id, resolution)
  return TradeCandlesResponse(**result)


@router.get("/{trade_id}/screenshots")
async def list_screenshots(trade_id: int) -> ApiResponse[list[TradeScreenshotResponse]]:
  screenshots = await screenshot_service.list_screenshots(trade_id)
  return ApiResponse(data=[TradeScreenshotResponse(**s) for s in screenshots])
