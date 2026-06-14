/**
 * Minimum impact threshold for news filtering, most → least restrictive.
 * `LOW` shows every event; `NONE` is an internal marker and never selectable.
 */
export type NewsMinImpact = 'HIGH' | 'MEDIUM' | 'LOW'

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
}

/** Partial update payload for `PATCH /api/preferences`. */
export type PreferencesUpdate = Partial<Preferences>
