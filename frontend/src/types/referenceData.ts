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

export type AssetCategory = 'Forex' | 'Crypto' | 'Stock' | 'ETF' | 'Indices'

export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  'Forex',
  'Crypto',
  'Stock',
  'ETF',
  'Indices',
]

export interface Asset {
  id: number
  name: string
  category: AssetCategory
  currency: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface AssetInput {
  name: string
  category: AssetCategory
  currency?: string | null
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
