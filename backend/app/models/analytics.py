from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.models.response import ApiResponse


class TagsLogic(str, Enum):
  """How multiple tag filters combine."""

  and_ = "AND"
  or_ = "OR"


class RangeOperator(str, Enum):
  """Comparison operator for a numeric range filter."""

  gte = "gte"
  lte = "lte"


class DurationUnit(str, Enum):
  """Unit the duration range value is expressed in."""

  minutes = "minutes"
  hours = "hours"
  days = "days"


class SortField(str, Enum):
  """Sortable columns for the analytics trade list."""

  trade_date = "trade_date"
  performance_r = "performance_r"
  duration = "duration"


class SortOrder(str, Enum):
  """Sort direction for the analytics trade list."""

  asc = "asc"
  desc = "desc"


class Statistics(BaseModel):
  """Aggregate KPIs over the filtered trade set (all P&L in R-multiples)."""

  total_trades: int
  winning_trades: int
  losing_trades: int
  breakeven_trades: int
  total_pnl: float
  avg_pnl: float
  win_rate: float
  avg_win: float
  avg_loss: float
  expectancy: float
  profit_factor: Optional[float] = None
  avg_duration_hours: float
  winning_streak: int
  losing_streak: int
  best_trade: Optional[float] = None
  worst_trade: Optional[float] = None


class AssetFilter(BaseModel):
  """An asset present in the dataset, for the filter dropdown."""

  id: int
  name: str
  currency: Optional[str] = None


class NamedFilter(BaseModel):
  """A tag or emotion present in the dataset, for the filter dropdown."""

  id: int
  name: str


class TradeEmotion(BaseModel):
  """An emotion attached to a trade row, with its severity for color coding."""

  id: int
  name: str
  severity: str


class DateRange(BaseModel):
  """Earliest and latest trade dates present in the dataset (YYYY-MM-DD)."""

  min: Optional[str] = None
  max: Optional[str] = None


class AvailableFilters(BaseModel):
  """Distinct filter values actually present in the (missed-adjusted) dataset."""

  assets: list[AssetFilter]
  directions: list[str]
  timeframes: list[str]
  tags: list[NamedFilter]
  emotions: list[NamedFilter]
  types: list[str]
  date_range: DateRange


class AnalyticsStatistics(BaseModel):
  """Payload for `GET /api/analytics/statistics`."""

  statistics: Statistics
  available_filters: AvailableFilters


class AnalyticsStatisticsResponse(ApiResponse[AnalyticsStatistics]):
  """Standard `{ data, error }` envelope around the statistics payload."""


class AnalyticsTrade(BaseModel):
  """A single trade in the filtered, paginated analytics list."""

  id: int
  asset_id: Optional[int] = None
  asset_name: Optional[str] = None
  asset_currency: Optional[str] = None
  account_type: str
  status: str
  direction: Optional[str] = None
  tags: list[NamedFilter] = Field(default_factory=list)
  emotions: list[TradeEmotion] = Field(default_factory=list)
  performance_r: Optional[float] = None
  timeframe_unit: Optional[str] = None
  timeframe_value: Optional[int] = None
  trade_date: Optional[str] = None
  duration_minutes: Optional[float] = None
  missed_opportunity: bool


class Pagination(BaseModel):
  """Standard pagination metadata for a paginated list."""

  page: int
  per_page: int
  total: int
  total_pages: int


class AnalyticsTrades(BaseModel):
  """Payload for `GET /api/analytics/trades`."""

  trades: list[AnalyticsTrade]
  pagination: Pagination


class AnalyticsTradesResponse(ApiResponse[AnalyticsTrades]):
  """Standard `{ data, error }` envelope around the trade list payload."""


# ---------------------------------------------------------------------------
# Breakdown models
# ---------------------------------------------------------------------------


class AssetBreakdown(BaseModel):
  """Per-asset aggregate statistics."""

  asset_id: int
  asset_name: str
  asset_currency: Optional[str] = None
  total_trades: int
  winning_trades: int
  losing_trades: int
  breakeven_trades: int
  total_pnl: float
  win_rate: float
  avg_pnl: float
  profit_factor: Optional[float] = None


class TagBreakdown(BaseModel):
  """Per-tag aggregate statistics."""

  tag_id: int
  tag_name: str
  total_trades: int
  winning_trades: int
  losing_trades: int
  breakeven_trades: int
  total_pnl: float
  win_rate: float
  avg_pnl: float
  profit_factor: Optional[float] = None


class DayHourCell(BaseModel):
  """Aggregate cell for a day-of-week / hour slot."""

  total_trades: int
  winning_trades: int
  total_pnl: float
  win_rate: float


class RDistributionBucket(BaseModel):
  """A single bucket in the R-distribution histogram."""

  bucket: str
  min: Optional[float] = None
  max: Optional[float] = None
  count: int


class CumulativeRPoint(BaseModel):
  """One data point in the cumulative R curve."""

  trade_date: str
  trade_id: int
  performance_r: float
  cumulative_r: float


class AnalyticsBreakdowns(BaseModel):
  """Payload for `GET /api/analytics/breakdowns`."""

  by_asset: list[AssetBreakdown]
  by_tag: list[TagBreakdown]
  by_day_hour: dict[str, dict[str, DayHourCell]]
  r_distribution: list[RDistributionBucket]
  cumulative_r: list[CumulativeRPoint]


class AnalyticsBreakdownsResponse(ApiResponse[AnalyticsBreakdowns]):
  """Standard `{ data, error }` envelope around the breakdowns payload."""
