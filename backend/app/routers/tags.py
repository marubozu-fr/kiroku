from fastapi import APIRouter

from app.models.response import ApiResponse
from app.models.tag import TagCreate, TagResponse, TagUpdate
from app.services import tag_service

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("")
async def list_tags(active: bool = False) -> ApiResponse[list[TagResponse]]:
  tags = await tag_service.list_tags(active_only=active)
  return ApiResponse(data=[TagResponse(**tag) for tag in tags])


@router.get("/{tag_id}")
async def get_tag(tag_id: int) -> ApiResponse[TagResponse]:
  tag = await tag_service.get_tag(tag_id)
  return ApiResponse(data=TagResponse(**tag))


@router.post("", status_code=201)
async def create_tag(payload: TagCreate) -> ApiResponse[TagResponse]:
  tag = await tag_service.create_tag(payload)
  return ApiResponse(data=TagResponse(**tag))


@router.put("/{tag_id}")
async def update_tag(tag_id: int, payload: TagUpdate) -> ApiResponse[TagResponse]:
  tag = await tag_service.update_tag(tag_id, payload)
  return ApiResponse(data=TagResponse(**tag))


@router.delete("/{tag_id}")
async def delete_tag(tag_id: int) -> ApiResponse[TagResponse]:
  tag = await tag_service.delete_tag(tag_id)
  return ApiResponse(data=TagResponse(**tag))
