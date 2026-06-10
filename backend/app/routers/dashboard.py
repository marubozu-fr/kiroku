from fastapi import APIRouter

from app.models.dashboard import (
  DashboardAccountType,
  DashboardData,
  DashboardPeriod,
  DashboardResponse,
)
from app.services import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(
  period: DashboardPeriod = DashboardPeriod.ytd,
  account_type: DashboardAccountType = DashboardAccountType.live,
) -> DashboardResponse:
  data = await dashboard_service.get_dashboard(period.value, account_type.value)
  return DashboardResponse(data=DashboardData(**data))
