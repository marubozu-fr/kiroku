from enum import Enum
from typing import Optional

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


class NewsEventResponse(BaseModel):
  """Public shape of a news event (omits the internal `synced_at` field)."""

  model_config = ConfigDict(use_enum_values=True)

  id: str
  date: str
  title: str
  currency: str
  impact: NewsImpact
  forecast: str
  previous: str


class NewsListMeta(BaseModel):
  """Metadata accompanying a news list response."""

  count: int
  start: str
  end: str


class NewsListResponse(BaseModel):
  """Envelope for GET /api/news: the event list plus range metadata."""

  data: list[NewsEventResponse]
  meta: NewsListMeta
  error: Optional[str] = None


class SyncResult(BaseModel):
  """Result of a manual or auto news sync."""

  synced: int
  week_start: Optional[str] = None
  week_end: Optional[str] = None


class SyncStatus(BaseModel):
  """Current sync state for GET /api/news/status."""

  last_sync: Optional[str] = None
  is_stale: bool
