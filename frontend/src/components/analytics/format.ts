/**
 * Analytics-specific formatting helpers.
 */

/**
 * Format a duration expressed as a float number of hours into a human-readable
 * string: "Xh Ym". Minutes are rounded to the nearest integer.
 *
 * Examples:
 *   4.2  → "4h 12m"
 *   0.5  → "30m"
 *   0    → "0m"
 *   1.0  → "1h 0m"
 */
export function formatDuration(hours: number): string {
  if (hours <= 0) return '0m'
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
