from typing import Optional

from fastapi import APIRouter, Query

from app.models.projections import Projections, ProjectionsResponse
from app.services import projections_service

router = APIRouter(prefix="/api/projections", tags=["projections"])


@router.get("")
async def get_projections(
  start_date: Optional[str] = Query(None),
  assets: Optional[str] = Query(None),
  goal_r: Optional[float] = Query(None),
  simulations: int = Query(1000, ge=1),
) -> ProjectionsResponse:
  simulations = max(100, min(simulations, 5000))
  data = await projections_service.get_projections(
    start_date=start_date,
    assets_raw=assets,
    goal_r=goal_r,
    simulations=simulations,
  )
  return ProjectionsResponse(data=Projections(**data))
