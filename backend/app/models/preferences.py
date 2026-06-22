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
