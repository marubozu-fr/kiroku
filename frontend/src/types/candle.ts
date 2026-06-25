/**
 * Types for the trade chart / candle endpoint.
 *
 * Field names mirror the API's snake_case JSON so responses map directly
 * with no transform layer.
 */

export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ChartMarker {
  timestamp: number
  type: 'entry' | 'exit'
  side: 'Buy' | 'Sell'
  price: number
  quantity: number
}

export interface ChartLevels {
  stop_loss: number | null
  take_profits: number[]
}

export interface ChartWindow {
  start: string
  end: string
}

export interface TradeChartData {
  ticker: string
  resolution: string
  candles: Candle[]
  markers: ChartMarker[]
  levels: ChartLevels
  window: ChartWindow
}

export interface CandleMeta {
  reason: string
}

export interface TradeCandlesResponse {
  data: TradeChartData | null
  meta: CandleMeta | null
  error: string | null
}

export type ChartResolution = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1'

export const CHART_RESOLUTIONS: ChartResolution[] = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']
