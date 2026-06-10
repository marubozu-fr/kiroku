import i18n from '@/i18n'

/**
 * Dashboard-specific number formatting.
 *
 * Win rate and profit factor are not signed P&L values, so they use plain
 * locale-aware decimals (no `+` sign) — unlike the signed `formatR` /
 * `formatPercent` helpers in `@/components/journal/format`, which the dashboard
 * reuses for Avg R and Best / Worst.
 */

/** Locale-aware fixed two-digit decimal, e.g. `63.83`. */
function formatDecimal(value: number): string {
  return new Intl.NumberFormat(i18n.language || 'en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Win rate as an unsigned percentage, e.g. `63.83%`. */
export function formatWinRate(value: number): string {
  return `${formatDecimal(value)}%`
}

/** Profit factor as a plain two-digit decimal, e.g. `2.14`. */
export function formatProfitFactor(value: number): string {
  return formatDecimal(value)
}

/** Win rate is green at or above 50%, red below — its own threshold, not P&L. */
export function winRateColor(value: number): string {
  return value >= 50 ? 'green.6' : 'red.6'
}

/** Profit factor: green ≥ 1.5, red < 1.0, dimmed in between. */
export function profitFactorColor(value: number): string {
  if (value >= 1.5) return 'green.6'
  if (value < 1.0) return 'red.6'
  return 'dimmed'
}
