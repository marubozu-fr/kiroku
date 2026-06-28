from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.emotion import EmotionResponse
from app.models.tag import TagResponse


class ActivityType(str, Enum):
  buy = "Buy"
  sell = "Sell"


class TradeDirection(str, Enum):
  long = "Long"
  short = "Short"


class TradeStatus(str, Enum):
  open = "Open"
  closed = "Closed"
  partial = "Partial"
  breakeven = "Breakeven"


class AccountType(str, Enum):
  test = "test"
  demo = "demo"
  live = "live"


class TradeActivityCreate(BaseModel):
  """A single buy or sell execution to attach to a trade."""

  model_config = ConfigDict(use_enum_values=True)

  type: ActivityType
  price: float = Field(gt=0)
  quantity: float = Field(gt=0)
  date: str = Field(min_length=1)


class TradeActivityResponse(BaseModel):
  """Response schema for a single trade activity."""

  id: int
  trade_id: int
  type: ActivityType
  price: float
  quantity: float
  date: str
  is_entry: bool


class TradeScreenshotResponse(BaseModel):
  """Response schema for a trade screenshot record."""

  id: int
  trade_id: int
  filename: str
  timeframe_unit: Optional[str] = None
  timeframe_value: Optional[int] = None
  label: Optional[str] = None
  created_at: Optional[str] = None


class TradeCreate(BaseModel):
  """Request body for creating a trade."""

  model_config = ConfigDict(use_enum_values=True)

  asset_id: int
  account_type: AccountType = AccountType.live
  stop_loss: Optional[float] = None
  notes: Optional[str] = Field(default=None, max_length=2000)
  missed_opportunity: bool = False
  risk_per_trade: Optional[float] = None
  timeframe_unit: Optional[str] = Field(default=None, max_length=20)
  timeframe_value: Optional[int] = None
  # Per-trade chart timeframe overrides (issue #236). None falls back to the
  # user's chart_timeframes_default; [] means "entry timeframe only". Validated
  # in trade_service. Each item is {"unit": "m"|"h"|"D"|"W", "value": <int>}.
  chart_timeframes: Optional[list[dict]] = None
  activities: list[TradeActivityCreate] = Field(min_length=1)
  tag_ids: list[int] = Field(default_factory=list)
  emotion_ids: list[int] = Field(default_factory=list)


class TradeUpdate(BaseModel):
  """Request body for updating a trade. All fields optional (partial update)."""

  model_config = ConfigDict(use_enum_values=True)

  asset_id: Optional[int] = None
  account_type: Optional[AccountType] = None
  stop_loss: Optional[float] = None
  notes: Optional[str] = Field(default=None, max_length=2000)
  missed_opportunity: Optional[bool] = None
  risk_per_trade: Optional[float] = None
  timeframe_unit: Optional[str] = Field(default=None, max_length=20)
  timeframe_value: Optional[int] = None
  # Per-trade chart timeframe overrides (issue #236). Omitted = leave unchanged
  # (exclude_unset); explicit null = reset to user defaults (store NULL);
  # [] = clear overrides and chart only the entry timeframe.
  chart_timeframes: Optional[list[dict]] = None
  activities: Optional[list[TradeActivityCreate]] = Field(default=None, min_length=1)
  tag_ids: Optional[list[int]] = None
  emotion_ids: Optional[list[int]] = None


class TradeSummary(BaseModel):
  """Lightweight trade representation for list responses — scalar columns only."""

  id: int
  asset_id: Optional[int] = None
  account_type: AccountType = AccountType.live
  status: TradeStatus
  direction: Optional[TradeDirection] = None
  stop_loss: Optional[float] = None
  notes: Optional[str] = None
  missed_opportunity: bool
  risk_per_trade: Optional[float] = None
  avg_entry_price: Optional[float] = None
  avg_exit_price: Optional[float] = None
  risk: Optional[float] = None
  reward: Optional[float] = None
  performance_r: Optional[float] = None
  timeframe_unit: Optional[str] = None
  timeframe_value: Optional[int] = None
  trade_date: Optional[str] = None
  created_at: Optional[str] = None
  updated_at: Optional[str] = None


class ResolvedTimeframe(BaseModel):
  """One effective chart timeframe for a trade (issue #236).

  `resolution` is the `{value}{unit}` token passed to the candles endpoint;
  `is_entry` flags the trade's entry timeframe within the resolved list.
  """

  unit: str
  value: int
  resolution: str
  is_entry: bool


class TradeResponse(TradeSummary):
  """Full trade detail, including nested activities, tags, emotions, screenshots."""

  # Raw per-trade override as stored (None = inherit user defaults), plus the
  # computed effective list the frontend renders (always present) — issue #236.
  chart_timeframes: Optional[list[dict]] = None
  resolved_chart_timeframes: list[ResolvedTimeframe] = Field(default_factory=list)
  activities: list[TradeActivityResponse] = Field(default_factory=list)
  tags: list[TagResponse] = Field(default_factory=list)
  emotions: list[EmotionResponse] = Field(default_factory=list)
  screenshots: list[TradeScreenshotResponse] = Field(default_factory=list)


class YearStatistics(BaseModel):
  """Aggregated statistics for all trades in a given year."""

  total_trades: int
  winning_trades: int
  losing_trades: int
  breakeven_trades: int
  total_pnl: float
  avg_pnl: float
  win_rate: float
  expectancy: float
  profit_factor: float
