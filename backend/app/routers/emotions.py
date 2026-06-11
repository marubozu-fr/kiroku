from typing import Optional

from fastapi import APIRouter

from app.models.emotion import (
  EmotionCategory,
  EmotionCreate,
  EmotionResponse,
  EmotionTradeCount,
  EmotionUpdate,
)
from app.models.response import ApiResponse
from app.services import emotion_service

router = APIRouter(prefix="/api/emotions", tags=["emotions"])


@router.get("")
async def list_emotions(
  category: Optional[EmotionCategory] = None,
) -> ApiResponse[list[EmotionResponse]]:
  emotions = await emotion_service.list_emotions(category=category)
  return ApiResponse(data=[EmotionResponse(**emotion) for emotion in emotions])


@router.get("/grouped")
async def grouped_emotions() -> ApiResponse[dict[str, list[EmotionResponse]]]:
  grouped = await emotion_service.group_emotions()
  return ApiResponse(
    data={category: [EmotionResponse(**emotion) for emotion in emotions] for category, emotions in grouped.items()}
  )


@router.get("/{emotion_id}")
async def get_emotion(emotion_id: int) -> ApiResponse[EmotionResponse]:
  emotion = await emotion_service.get_emotion(emotion_id)
  return ApiResponse(data=EmotionResponse(**emotion))


@router.get("/{emotion_id}/trade-count")
async def get_emotion_trade_count(emotion_id: int) -> ApiResponse[EmotionTradeCount]:
  trade_count = await emotion_service.count_trades(emotion_id)
  return ApiResponse(data=EmotionTradeCount(trade_count=trade_count))


@router.post("", status_code=201)
async def create_emotion(payload: EmotionCreate) -> ApiResponse[EmotionResponse]:
  emotion = await emotion_service.create_emotion(payload)
  return ApiResponse(data=EmotionResponse(**emotion))


@router.put("/{emotion_id}")
async def update_emotion(emotion_id: int, payload: EmotionUpdate) -> ApiResponse[EmotionResponse]:
  emotion = await emotion_service.update_emotion(emotion_id, payload)
  return ApiResponse(data=EmotionResponse(**emotion))


@router.delete("/{emotion_id}", status_code=204)
async def delete_emotion(emotion_id: int) -> None:
  await emotion_service.delete_emotion(emotion_id)
