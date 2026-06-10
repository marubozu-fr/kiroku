from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.models.response import ApiResponse


class DashboardPeriod(str, Enum):
  """Time window applied to dashboard date filtering."""

  ytd = "ytd"
  one_year = "1y"
  five_year = "5y"
  all = "all"


class DashboardAccountType(str, Enum):
  """Account-type filter for the dashboard. `all` disables the filter."""

  live = "live"
  demo = "demo"
  test = "test"
  all = "all"


class DashboardStats(BaseModel):
  """Aggregate statistics over the period-filtered, scored trades."""

  total_trades: int
  win_rate: float
  avg_r: float
  profit_factor: float
  best_r: Optional[float] = None
  worst_r: Optional[float] = None
  total_r: float
  total_pct: float


class MonthlyDataPoint(BaseModel):
  """One month in the chart series (zero-filled when no trades fell in it)."""

  year: int
  month: int
  month_label: str
  value_r: float
  value_pct: float
  trade_count: int


class EquityDataPoint(BaseModel):
  """One point on the running equity curve — one per scored trade."""

  date: str
  cumulative_r: float
  cumulative_pct: float
  trade_id: int


class RecentTradeItem(BaseModel):
  """A trade in the recent-activity list (independent of the period filter)."""

  id: int
  asset_name: Optional[str] = None
  asset_currency: Optional[str] = None
  direction: Optional[str] = None
  status: str
  performance_r: Optional[float] = None
  performance_pct: Optional[float] = None
  trade_date: Optional[str] = None


class DashboardData(BaseModel):
  """The full dashboard payload returned by `GET /api/dashboard`."""

  stats: DashboardStats
  monthly: list[MonthlyDataPoint]
  equity: list[EquityDataPoint]
  recent_trades: list[RecentTradeItem]


class DashboardResponse(ApiResponse[DashboardData]):
  """Standard `{ data, error }` envelope around the dashboard payload."""
