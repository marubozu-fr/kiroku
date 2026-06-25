from fastapi import APIRouter

from app.errors import ValidationError
from app.models.massive import TickerSearchResult
from app.models.response import ApiResponse
from app.services import massive_service
from app.services.massive_service import ALLOWED_MARKETS

router = APIRouter(prefix="/api/massive", tags=["massive"])


@router.get("/tickers")
async def search_tickers(
  search: str, market: str = "fx"
) -> ApiResponse[list[TickerSearchResult]]:
  query = search.strip()
  if len(query) < 2:
    raise ValidationError("search must be at least 2 characters")
  if market not in ALLOWED_MARKETS:
    raise ValidationError(
      f"market must be one of: {', '.join(ALLOWED_MARKETS)}"
    )
  results = await massive_service.search_tickers(query, market)
  return ApiResponse(data=[TickerSearchResult(**result) for result in results])
