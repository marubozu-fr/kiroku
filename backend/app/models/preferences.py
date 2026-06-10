from typing import Optional

from pydantic import BaseModel, Field


class PreferencesResponse(BaseModel):
  """Response schema for the single user-preferences row."""

  risk_per_trade_default: float


class PreferencesUpdate(BaseModel):
  """Request body for a partial preferences update. All fields optional."""

  # > 0 and at most 100: a risk percentage of zero or negative is meaningless.
  risk_per_trade_default: Optional[float] = Field(default=None, gt=0, le=100)
