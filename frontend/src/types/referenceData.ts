/**
 * Domain types for the reference data managed on the Settings page:
 * assets, tags, and emotions.
 *
 * Field names mirror the API's snake_case JSON so responses map directly
 * with no transform layer.
 */

/** Number of trades referencing a given asset, tag, or emotion. */
export interface TradeCount {
  trade_count: number
}

export type AssetCategory = 'Forex' | 'Crypto' | 'Stock' | 'ETF' | 'Indices' | 'Futures'

export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  'Forex',
  'Crypto',
  'Stock',
  'ETF',
  'Indices',
  'Futures',
]

export interface Asset {
  id: number
  name: string
  category: AssetCategory
  currency: string | null
  /** Linked Massive market-data ticker (e.g. `C:EURUSD`), or null if unlinked. */
  massive_ticker: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface AssetInput {
  name: string
  category: AssetCategory
  currency?: string | null
  massive_ticker?: string | null
}

export interface Tag {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface TagInput {
  name: string
  description?: string | null
}

export type EmotionSeverity = 'Good' | 'Warning' | 'Bad'

export const EMOTION_SEVERITIES: readonly EmotionSeverity[] = [
  'Good',
  'Warning',
  'Bad',
]

export type EmotionCategory =
  | 'Emotional State'
  | 'Mental Triggers'
  | 'Focus & Clarity'
  | 'Execution Confidence'
  | 'Why This Trade?'

export const EMOTION_CATEGORIES: readonly EmotionCategory[] = [
  'Emotional State',
  'Mental Triggers',
  'Focus & Clarity',
  'Execution Confidence',
  'Why This Trade?',
]

// Maps the English enum values (stored as-is in the database) to i18n keys so
// category labels render in the user's language. See issue #154.
export const CATEGORY_I18N_KEYS: Record<EmotionCategory, string> = {
  'Emotional State': 'settings.emotions.categories.emotional_state',
  'Mental Triggers': 'settings.emotions.categories.mental_triggers',
  'Focus & Clarity': 'settings.emotions.categories.focus_clarity',
  'Execution Confidence': 'settings.emotions.categories.execution_confidence',
  'Why This Trade?': 'settings.emotions.categories.why_this_trade',
}

export interface Emotion {
  id: number
  name: string
  description: string | null
  severity: EmotionSeverity
  category: EmotionCategory
  created_at: string | null
  updated_at: string | null
}

export interface EmotionInput {
  name: string
  description?: string | null
  severity: EmotionSeverity
  category: EmotionCategory
}
