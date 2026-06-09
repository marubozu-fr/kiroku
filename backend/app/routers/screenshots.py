from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.models.response import ApiResponse
from app.models.trade import TradeScreenshotResponse
from app.services import screenshot_service

router = APIRouter(prefix="/api/screenshots", tags=["screenshots"])


@router.get("/{filename}")
async def serve_screenshot(filename: str) -> FileResponse:
  path, media_type = await screenshot_service.resolve_screenshot_file(filename)
  return FileResponse(path, media_type=media_type)


@router.delete("/{screenshot_id}")
async def delete_screenshot(screenshot_id: int) -> ApiResponse[TradeScreenshotResponse]:
  screenshot = await screenshot_service.delete_screenshot(screenshot_id)
  return ApiResponse(data=TradeScreenshotResponse(**screenshot))
