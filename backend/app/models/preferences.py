from typing import Literal, Optional

from pydantic import BaseModel, Field

# Minimum impact level a user may select for news filtering. NONE is excluded:
# it is an internal "no impact / holiday" marker, never a meaningful threshold.
NewsMinImpact = Literal["HIGH", "MEDIUM", "LOW"]


class PreferencesResponse(BaseModel):
  """Response schema for the single user-preferences row."""

  risk_per_trade_default: float
  news_enabled: bool
  news_currencies: list[str]
  news_min_impact: NewsMinImpact
  backup_directory: Optional[str]
  backup_reminder_days: int
  last_backup_at: Optional[str]
  # Stored verbatim (empty string when unset). Single-user local app, so the
  # raw key is returned to the client to prefill the Settings field.
  massive_api_key: str
  # Ordered list of chart timeframes the user wants available in the UI.
  # Each entry is {"unit": "m"|"h"|"D"|"W", "value": <positive int>}.
  chart_timeframes_default: list[dict]
  entry_timeframe_unit_default: Optional[str]
  entry_timeframe_value_default: Optional[int]
  # Soft-limit the frontend warns past; sourced from a backend constant so the
  # client never hardcodes it.
  chart_timeframes_warning_threshold: int


class PreferencesUpdate(BaseModel):
  """Request body for a partial preferences update. All fields optional."""

  # > 0 and at most 100: a risk percentage of zero or negative is meaningless.
  risk_per_trade_default: Optional[float] = Field(default=None, gt=0, le=100)
  news_enabled: Optional[bool] = None
  news_currencies: Optional[list[str]] = None
  news_min_impact: Optional[NewsMinImpact] = None
  backup_directory: Optional[str] = Field(default=None)
  # 0 disables the reminder; other values are cadences in days.
  backup_reminder_days: Optional[Literal[0, 7, 14, 30]] = Field(default=None)
  # Massive market-data API key. An empty string clears it (the column is
  # NOT NULL DEFAULT ''); None is dropped before persisting.
  massive_api_key: Optional[str] = Field(default=None, max_length=200)
  # Ordered list of chart timeframes. Validated in preferences_service.
  chart_timeframes_default: Optional[list[dict]] = None
  # Entry-timeframe defaults: must be provided together or both omitted/null.
  entry_timeframe_unit_default: Optional[str] = None
  entry_timeframe_value_default: Optional[int] = None
