from typing import Optional

from pydantic import BaseModel


class Candle(BaseModel):
  """A single OHLCV candle. Timestamp is Unix milliseconds."""

  timestamp: int
  open: float
  high: float
  low: float
  close: float
  volume: float


class ChartMarker(BaseModel):
  """An entry/exit marker derived from a trade activity."""

  timestamp: int
  type: str
  side: str
  price: float
  quantity: float


class ChartLevels(BaseModel):
  """Price levels overlaid on the chart."""

  stop_loss: Optional[float] = None
  take_profits: list[float] = []


class ChartWindow(BaseModel):
  """Inclusive date range (ISO YYYY-MM-DD) covered by the candle query."""

  start: str
  end: str


class TradeChartData(BaseModel):
  """Chart payload for a single trade: candles, markers, levels and window."""

  ticker: str
  resolution: str
  candles: list[Candle]
  markers: list[ChartMarker]
  levels: ChartLevels
  window: ChartWindow


class CandleMeta(BaseModel):
  """Metadata explaining why `data` is null or candles are empty.

  reason is one of:
  - 'no_ticker': the trade's asset has no massive_ticker (data is null)
  - 'pending':   no candles are available yet for the range (candles empty)
  """

  reason: str


class TradeCandlesResponse(BaseModel):
  """Envelope for GET /api/trades/{id}/candles."""

  data: Optional[TradeChartData] = None
  meta: Optional[CandleMeta] = None
  error: Optional[str] = None
