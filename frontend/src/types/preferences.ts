/**
 * Minimum impact threshold for news filtering, most → least restrictive.
 * `LOW` shows every event; `NONE` is an internal marker and never selectable.
 */
export type NewsMinImpact = 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * A single chart timeframe. `unit` follows the TradingView casing convention
 * (`m`, `h`, `D`, `W`); `value` is a positive integer (e.g. `{ value: 15,
 * unit: 'm' }` → "15m").
 */
export interface ChartTimeframe {
  unit: string
  value: number
}

/**
 * Application-level business defaults stored in the backend (issue #62).
 * Visual preferences (theme, language) stay in localStorage and are not part
 * of this type.
 */
export interface Preferences {
  risk_per_trade_default: number
  news_enabled: boolean
  news_currencies: string[]
  news_min_impact: NewsMinImpact
  backup_directory: string | null
  backup_reminder_days: number
  last_backup_at: string | null
  /** Massive market-data API key; empty string when not configured. */
  massive_api_key: string
  /** Ordered list of chart timeframes pre-filled on every trade chart. */
  chart_timeframes_default: ChartTimeframe[]
  /** Entry-timeframe defaults; both null together when unset. */
  entry_timeframe_unit_default: string | null
  entry_timeframe_value_default: number | null
  /** Soft limit past which the UI warns about chart load times. */
  chart_timeframes_warning_threshold: number
}

/**
 * Partial update payload for `PATCH /api/preferences`. `last_backup_at` is
 * managed by the backend (set when a backup runs) and is not user-editable.
 */
export type PreferencesUpdate = Partial<
  Pick<
    Preferences,
    | 'risk_per_trade_default'
    | 'news_enabled'
    | 'news_currencies'
    | 'news_min_impact'
    | 'backup_directory'
    | 'backup_reminder_days'
    | 'massive_api_key'
    | 'chart_timeframes_default'
    | 'entry_timeframe_unit_default'
    | 'entry_timeframe_value_default'
  >
>
