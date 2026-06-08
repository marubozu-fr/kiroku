from fastapi import APIRouter

from app.models.asset import AssetCreate, AssetResponse, AssetUpdate
from app.models.response import ApiResponse
from app.services import asset_service

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("")
async def list_assets(active: bool = False) -> ApiResponse[list[AssetResponse]]:
  assets = await asset_service.list_assets(active_only=active)
  return ApiResponse(data=[AssetResponse(**asset) for asset in assets])


@router.get("/{asset_id}")
async def get_asset(asset_id: int) -> ApiResponse[AssetResponse]:
  asset = await asset_service.get_asset(asset_id)
  return ApiResponse(data=AssetResponse(**asset))


@router.post("", status_code=201)
async def create_asset(payload: AssetCreate) -> ApiResponse[AssetResponse]:
  asset = await asset_service.create_asset(payload)
  return ApiResponse(data=AssetResponse(**asset))


@router.put("/{asset_id}")
async def update_asset(
  asset_id: int, payload: AssetUpdate
) -> ApiResponse[AssetResponse]:
  asset = await asset_service.update_asset(asset_id, payload)
  return ApiResponse(data=AssetResponse(**asset))


@router.delete("/{asset_id}")
async def delete_asset(asset_id: int) -> ApiResponse[AssetResponse]:
  asset = await asset_service.delete_asset(asset_id)
  return ApiResponse(data=AssetResponse(**asset))
