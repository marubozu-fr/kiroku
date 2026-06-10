/**
 * Application-level business defaults stored in the backend (issue #62).
 * Visual preferences (theme, language) stay in localStorage and are not part
 * of this type.
 */
export interface Preferences {
  risk_per_trade_default: number
}

/** Partial update payload for `PATCH /api/preferences`. */
export type PreferencesUpdate = Partial<Preferences>
