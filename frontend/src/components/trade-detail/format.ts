/**
 * Formatting helpers specific to the trade detail view.
 */

import type { TradeActivity } from '@/types/trade'

/**
 * Compute a human-readable duration between the earliest and latest
 * activity dates. Returns `—` if fewer than 2 activities are provided.
 *
 * Examples: `2d 4h`, `3h 15m`, `45m`, `< 1m`
 */
export function formatTradeDuration(activities: TradeActivity[]): string {
  if (activities.length < 2) {
    return '—'
  }

  const timestamps = activities.map((a) => new Date(a.date).getTime())
  const earliest = Math.min(...timestamps)
  const latest = Math.max(...timestamps)
  const diffMs = latest - earliest

  if (diffMs <= 0) {
    return '—'
  }

  const totalMinutes = Math.floor(diffMs / 60_000)

  if (totalMinutes < 1) {
    return '< 1m'
  }

  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`)

  return parts.join(' ')
}

/**
 * Build a display label for a screenshot timeframe (e.g. `"15m"`, `"1h"`).
 * Timeframe is required on every screenshot since issue #56; the `—` fallback
 * only guards legacy rows created before it was enforced.
 */
export function formatTimeframeGroup(
  value: number | null,
  unit: string | null,
): string {
  if (value === null || unit === null) {
    return '—'
  }
  return `${value}${unit}`
}
