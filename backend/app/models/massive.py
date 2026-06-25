from typing import Optional

from pydantic import BaseModel


class TickerSearchResult(BaseModel):
  """A single ticker match from a Massive reference search."""

  ticker: str
  name: Optional[str] = None
  market: Optional[str] = None
  active: Optional[bool] = None
