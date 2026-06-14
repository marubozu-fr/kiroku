import logging
from datetime import date

from fastapi import APIRouter, Query

from app.models.news_event import (
  NewsListMeta,
  NewsListResponse,
  SyncResult,
  SyncStatus,
)
from app.models.response import ApiResponse
from app.services import news_service, preferences_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("")
async def get_news(
  start: date = Query(..., description="Inclusive start date (ISO, e.g. 2026-06-09)"),
  end: date = Query(..., description="Inclusive end date (ISO, e.g. 2026-06-15)"),
) -> NewsListResponse:
  """Return news events in [start, end] filtered by the user's preferences.

  When news is disabled the list is empty. If the stored data is stale, a sync
  is attempted first; a failed sync is logged and the cached data is served so
  the response is never blocked on the network.
  """
  start_str = start.isoformat()
  end_str = end.isoformat()
  preferences = await preferences_service.get_preferences()

  if not preferences["news_enabled"]:
    return NewsListResponse(
      data=[], meta=NewsListMeta(count=0, start=start_str, end=end_str)
    )

  if await news_service.is_sync_stale():
    try:
      await news_service.sync_current_week()
    except Exception as exc:  # noqa: BLE001 - never block the read on a sync failure
      logger.warning("Auto-sync failed, serving cached news: %s", exc)

  # Stored event dates are full UTC timestamps; widen `end` to the end of the
  # day so the final day is inclusive against the date-only query bound.
  events = await news_service.load_news_for_period(
    start_str,
    f"{end_str}T23:59:59.999999+00:00",
    preferences["news_currencies"],
    preferences["news_min_impact"],
  )
  return NewsListResponse(
    data=[event.model_dump() for event in events],
    meta=NewsListMeta(count=len(events), start=start_str, end=end_str),
  )


@router.post("/sync")
async def sync_news() -> ApiResponse[SyncResult]:
  """Trigger a sync of the current week's events from the feed."""
  result = await news_service.sync_current_week()
  return ApiResponse(data=SyncResult(**result))


@router.get("/status")
async def get_news_status() -> ApiResponse[SyncStatus]:
  """Return the last sync timestamp and whether the data is stale."""
  status = await news_service.get_sync_status()
  return ApiResponse(data=SyncStatus(**status))
