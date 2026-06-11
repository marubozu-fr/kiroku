from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.models.analytics import (
  AnalyticsStatistics,
  AnalyticsStatisticsResponse,
  AnalyticsTrades,
  AnalyticsTradesResponse,
  DurationUnit,
  RangeOperator,
  SortField,
  SortOrder,
  TagsLogic,
)
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def filter_params(
  date_from: Optional[str] = None,
  date_to: Optional[str] = None,
  asset_ids: Optional[str] = None,
  direction: Optional[str] = None,
  entry_timeframe: Optional[str] = None,
  tag_ids: Optional[str] = None,
  tags_logic: TagsLogic = TagsLogic.and_,
  emotion_ids: Optional[str] = None,
  types: Optional[str] = None,
  include_missed: bool = False,
  pnl_operator: Optional[RangeOperator] = None,
  pnl_value: Optional[float] = None,
  duration_operator: Optional[RangeOperator] = None,
  duration_value: Optional[int] = None,
  duration_unit: DurationUnit = DurationUnit.minutes,
) -> dict[str, Any]:
  """Collect the shared filter query parameters into a single dict."""
  return {
    "date_from": date_from,
    "date_to": date_to,
    "asset_ids": asset_ids,
    "direction": direction,
    "entry_timeframe": entry_timeframe,
    "tag_ids": tag_ids,
    "tags_logic": tags_logic,
    "emotion_ids": emotion_ids,
    "types": types,
    "include_missed": include_missed,
    "pnl_operator": pnl_operator,
    "pnl_value": pnl_value,
    "duration_operator": duration_operator,
    "duration_value": duration_value,
    "duration_unit": duration_unit,
  }


@router.get("/statistics")
async def get_statistics(
  params: dict[str, Any] = Depends(filter_params),
) -> AnalyticsStatisticsResponse:
  data = await analytics_service.get_statistics(params)
  return AnalyticsStatisticsResponse(data=AnalyticsStatistics(**data))


@router.get("/trades")
async def get_trades(
  params: dict[str, Any] = Depends(filter_params),
  page: int = Query(1, ge=1),
  per_page: int = Query(20, ge=1, le=200),
  sort_by: SortField = SortField.trade_date,
  sort_order: SortOrder = SortOrder.desc,
) -> AnalyticsTradesResponse:
  data = await analytics_service.get_trades(
    params, page, per_page, sort_by.value, sort_order.value
  )
  return AnalyticsTradesResponse(data=AnalyticsTrades(**data))
