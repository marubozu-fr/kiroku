/**
 * Domain types for trades.
 *
 * Field names mirror the API's snake_case JSON so responses map directly
 * with no transform layer. `TradeSummary` matches the lightweight shape the
 * list endpoint (`GET /api/trades`) returns — scalar columns only.
 */

export type TradeStatus = 'Open' | 'Closed' | 'Partial' | 'Breakeven'

export type TradeDirection = 'Long' | 'Short'

export interface TradeSummary {
  id: number
  asset_id: number | null
  status: TradeStatus
  direction: TradeDirection | null
  stop_loss: number | null
  notes: string | null
  missed_opportunity: boolean
  risk_per_trade: number | null
  avg_entry_price: number | null
  avg_exit_price: number | null
  risk: number | null
  reward: number | null
  performance_r: number | null
  realized_pnl: number | null
  timeframe_unit: string | null
  timeframe_value: number | null
  trade_date: string | null
  created_at: string | null
  updated_at: string | null
}
