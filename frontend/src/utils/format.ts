/**
 * Shared asset label formatting utilities.
 */

/**
 * Format an asset display label from name and currency fields.
 *
 * - name + currency → "NQ/USD"
 * - name only (null currency) → "NQ"
 * - null or empty name → "—"
 */
export function formatAssetLabel(name: string | null, currency: string | null): string {
  if (!name) return '—'
  if (!currency) return name
  return `${name}/${currency}`
}
