from fastapi import APIRouter, File, UploadFile

from app.models.response import ApiResponse
from app.services import backup_service

router = APIRouter(prefix="/api/backup", tags=["backup"])


@router.post("")
async def create_backup() -> ApiResponse[dict]:
  result = await backup_service.create_backup()
  return ApiResponse(data=result)


@router.post("/validate")
async def validate_backup(file: UploadFile = File(...)) -> ApiResponse[dict]:
  result = await backup_service.validate_backup(file)
  return ApiResponse(data=result)


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...)) -> ApiResponse[dict]:
  result = await backup_service.restore_backup(file)
  return ApiResponse(data=result)
