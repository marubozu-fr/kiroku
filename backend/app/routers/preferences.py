from fastapi import APIRouter

from app.models.preferences import PreferencesResponse, PreferencesUpdate
from app.models.response import ApiResponse
from app.services import preferences_service

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


@router.get("")
async def get_preferences() -> ApiResponse[PreferencesResponse]:
  preferences = await preferences_service.get_preferences()
  return ApiResponse(data=PreferencesResponse(**preferences))


@router.patch("")
async def update_preferences(
  payload: PreferencesUpdate,
) -> ApiResponse[PreferencesResponse]:
  preferences = await preferences_service.update_preferences(payload)
  return ApiResponse(data=PreferencesResponse(**preferences))
