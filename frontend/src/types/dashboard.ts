/**
 * Domain types for the dashboard endpoint (`GET /api/dashboard`).
 *
 * Field names mirror the API's snake_case JSON so responses map directly with
 * no transform layer (same convention as `@/types/trade`). `monthly`, `equity`
 * and `recent_trades` are consumed by the charts / recent-activity issues; the
 * shapes are declared here so the whole payload is typed in one place.
 */

export interface DashboardStats {
  total_trades: number
  win_rate: number
  avg_r: number
  profit_factor: number
  best_r: number | null
  worst_r: number | null
  total_r: number
  total_pct: number
}

export interface MonthlyDataPoint {
  year: number
  month: number
  month_label: string
  value_r: number
  value_pct: number
  trade_count: number
}

export interface EquityDataPoint {
  date: string
  cumulative_r: number
  cumulative_pct: number
  trade_id: number
}

export interface RecentTradeItem {
  id: number
  asset_name: string | null
  asset_currency: string | null
  direction: string | null
  status: string
  performance_r: number | null
  performance_pct: number | null
  trade_date: string | null
}

export interface DashboardData {
  stats: DashboardStats
  monthly: MonthlyDataPoint[]
  equity: EquityDataPoint[]
  recent_trades: RecentTradeItem[]
}
