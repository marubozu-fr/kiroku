/**
 * Domain types for trades.
 *
 * Field names mirror the API's snake_case JSON so responses map directly
 * with no transform layer. `TradeSummary` matches the lightweight shape the
 * list endpoint (`GET /api/trades`) returns — scalar columns only.
 */

import type { Emotion, Tag } from '@/types/referenceData'

export type TradeStatus = 'Open' | 'Closed' | 'Partial' | 'Breakeven'

export type TradeDirection = 'Long' | 'Short'

export type AccountType = 'test' | 'demo' | 'live'

export interface TradeSummary {
  id: number
  asset_id: number | null
  account_type: AccountType
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
  timeframe_unit: string | null
  timeframe_value: number | null
  trade_date: string | null
  created_at: string | null
  updated_at: string | null
}

export type ActivityType = 'Buy' | 'Sell'

export interface TradeActivity {
  id: number
  trade_id: number
  type: ActivityType
  price: number
  quantity: number
  date: string
  is_entry: boolean
}

export interface TradeScreenshot {
  id: number
  trade_id: number
  filename: string
  timeframe_unit: string | null
  timeframe_value: number | null
  created_at: string | null
}

export interface TradeDetail extends TradeSummary {
  activities: TradeActivity[]
  tags: Tag[]
  emotions: Emotion[]
  screenshots: TradeScreenshot[]
}

/** A single buy/sell activity as sent to the create/update endpoints. */
export interface TradeActivityInput {
  type: ActivityType
  price: number
  quantity: number
  date: string
}

/**
 * Request body for creating or updating a trade. Mirrors the backend's
 * `TradeCreate` model; the update endpoint accepts the same shape.
 */
export interface TradeInput {
  asset_id: number
  account_type: AccountType
  stop_loss: number | null
  notes: string | null
  missed_opportunity: boolean
  risk_per_trade: number | null
  timeframe_unit: string | null
  timeframe_value: number | null
  activities: TradeActivityInput[]
  tag_ids: number[]
  emotion_ids: number[]
}
