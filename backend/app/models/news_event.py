from enum import Enum

from pydantic import BaseModel, ConfigDict


class NewsImpact(str, Enum):
  """Normalized impact level of an economic calendar event."""

  high = "HIGH"
  medium = "MEDIUM"
  low = "LOW"
  none = "NONE"


class NewsEvent(BaseModel):
  """A single macro economic calendar event, stored in UTC."""

  # Persist the enum's string value so it maps directly to the TEXT column.
  model_config = ConfigDict(use_enum_values=True)

  id: str
  date: str
  title: str
  currency: str
  impact: NewsImpact
  forecast: str = ""
  previous: str = ""
  synced_at: str
