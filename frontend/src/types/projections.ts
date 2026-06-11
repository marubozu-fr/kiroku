/**
 * Domain types for the projections endpoint.
 *
 * Field names mirror the API's snake_case JSON — same convention as
 * `@/types/analytics`. The response wrapper type represents the unwrapped
 * `data` payload (the api client already strips the `{data,error}` envelope).
 */

// ---------------------------------------------------------------------------
// Filter params
// ---------------------------------------------------------------------------

export interface ProjectionFilters {
  start_date?: string
  assets?: string[]
  goal_r?: number
}

// ---------------------------------------------------------------------------
// API shapes — mirror backend/app/models/projections.py exactly
// ---------------------------------------------------------------------------

export interface ActualMonth {
  month: number
  label: string
  cumulative_r: number
  month_r: number
  trades_count: number
}

export interface ProjectedMonth {
  month: number
  label: string
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  estimated_trades: number
}

export interface ProjectionStats {
  expectancy: number
  win_rate: number
  std_deviation: number
  skewness: number
  kurtosis: number
  total_trades: number
  best_trade: number
  worst_trade: number
  max_winning_streak: number
  max_losing_streak: number
}

export interface GoalResult {
  target_r: number
  probability: number
}

export interface RiskResult {
  ruin_probability: number
  max_drawdown_median: number
}

export interface FiltersApplied {
  start_date: string | null
  assets: string[]
}

export interface Projections {
  actual_months: ActualMonth[]
  projected_months: ProjectedMonth[]
  stats: ProjectionStats
  goal: GoalResult | null
  risk: RiskResult
  filters_applied: FiltersApplied
}
