/**
 * Domain types for the analytics endpoints.
 *
 * Field names mirror the API's snake_case JSON — same convention as
 * `@/types/dashboard`. The "*Response" types represent the unwrapped `data`
 * payload (the api client already strips the `{data,error}` envelope).
 */

// ---------------------------------------------------------------------------
// Filter params
// ---------------------------------------------------------------------------

export interface AnalyticsFilters {
  date_from?: string
  date_to?: string
  asset_ids?: number[]
  direction?: string
  entry_timeframe?: string[]
  tag_ids?: number[]
  tags_logic?: 'AND' | 'OR'
  emotion_ids?: number[]
  types?: string[]
  include_missed?: boolean
  pnl_operator?: 'gte' | 'lte'
  pnl_value?: number
  duration_operator?: 'gte' | 'lte'
  duration_value?: number
  duration_unit?: 'minutes' | 'hours' | 'days'
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface StatisticsData {
  total_trades: number
  winning_trades: number
  losing_trades: number
  breakeven_trades: number
  total_pnl: number
  avg_pnl: number
  win_rate: number
  avg_win: number
  avg_loss: number
  expectancy: number
  profit_factor: number | null
  avg_duration_hours: number
  winning_streak: number
  losing_streak: number
  best_trade: number | null
  worst_trade: number | null
}

// ---------------------------------------------------------------------------
// Available filters
// ---------------------------------------------------------------------------

export interface AssetFilter {
  id: number
  name: string
  currency?: string | null
}

export interface NamedFilter {
  id: number
  name: string
}

export interface DateRange {
  min: string | null
  max: string | null
}

export interface AvailableFilters {
  assets: AssetFilter[]
  directions: string[]
  timeframes: string[]
  tags: NamedFilter[]
  emotions: NamedFilter[]
  types: string[]
  date_range: DateRange
}

export interface AnalyticsStatisticsResponse {
  statistics: StatisticsData
  available_filters: AvailableFilters
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

export interface AnalyticsTrade {
  id: number
  asset_id: number | null
  asset_name: string | null
  asset_currency: string | null
  account_type: string
  status: string
  direction: string | null
  performance_r: number | null
  timeframe_unit: string | null
  timeframe_value: number | null
  trade_date: string | null
  duration_minutes: number | null
  missed_opportunity: boolean
}

export interface Pagination {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export interface AnalyticsTradesResponse {
  trades: AnalyticsTrade[]
  pagination: Pagination
}

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

export interface AssetBreakdown {
  asset_id: number
  asset_name: string
  asset_currency: string | null
  total_trades: number
  winning_trades: number
  losing_trades: number
  breakeven_trades: number
  total_pnl: number
  win_rate: number
  avg_pnl: number
  profit_factor: number | null
}

export interface TagBreakdown {
  tag_id: number
  tag_name: string
  total_trades: number
  winning_trades: number
  losing_trades: number
  breakeven_trades: number
  total_pnl: number
  win_rate: number
  avg_pnl: number
  profit_factor: number | null
}

export interface DayHourCell {
  total_trades: number
  winning_trades: number
  total_pnl: number
  win_rate: number
}

export interface RDistributionBucket {
  bucket: string
  min: number | null
  max: number | null
  count: number
}

export interface CumulativeRPoint {
  trade_date: string
  trade_id: number
  performance_r: number
  cumulative_r: number
}

export interface AnalyticsBreakdownsResponse {
  by_asset: AssetBreakdown[]
  by_tag: TagBreakdown[]
  by_day_hour: Record<string, Record<string, DayHourCell>>
  r_distribution: RDistributionBucket[]
  cumulative_r: CumulativeRPoint[]
}
