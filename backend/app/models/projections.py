from typing import Optional

from pydantic import BaseModel

from app.models.response import ApiResponse


class ActualMonth(BaseModel):
  """Actual traded results for a single calendar month of the current year."""

  month: int
  label: str
  cumulative_r: float
  month_r: float
  trades_count: int


class ProjectedMonth(BaseModel):
  """Monte Carlo percentile fan for a single future calendar month."""

  month: int
  label: str
  p10: float
  p25: float
  p50: float
  p75: float
  p90: float
  estimated_trades: int


class ProjectionStats(BaseModel):
  """Descriptive statistics over the historical trade pool."""

  expectancy: float
  win_rate: float
  std_deviation: float
  skewness: float
  kurtosis: float
  total_trades: int
  best_trade: float
  worst_trade: float
  max_winning_streak: int
  max_losing_streak: int


class GoalResult(BaseModel):
  """Probability of reaching a cumulative-R target by year-end."""

  target_r: float
  probability: float


class RiskResult(BaseModel):
  """Downside risk metrics derived from the Monte Carlo paths."""

  ruin_probability: float
  max_drawdown_median: float


class FiltersApplied(BaseModel):
  """The query filters that were active for this projection run."""

  start_date: Optional[str] = None
  assets: list[str]


class Projections(BaseModel):
  """Full projection payload returned by GET /api/projections."""

  actual_months: list[ActualMonth]
  projected_months: list[ProjectedMonth]
  stats: ProjectionStats
  goal: Optional[GoalResult] = None
  risk: RiskResult
  filters_applied: FiltersApplied


class ProjectionsResponse(ApiResponse[Projections]):
  """Standard { data, error } envelope around the projections payload."""
