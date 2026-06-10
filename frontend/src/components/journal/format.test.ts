import { afterEach, describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import i18n from '@/i18n'

// Statically load the locales the date tests assert against. The app loads
// these lazily (see @/i18n), but tests need them available synchronously.
import 'dayjs/locale/fr'
import 'dayjs/locale/de'

import { formatLocalDate, formatPercent, formatPnl, formatR } from './format'

afterEach(async () => {
  await i18n.changeLanguage('en')
  dayjs.locale('en')
})

describe('formatPnl', () => {
  it('returns an em dash when there is no R value', () => {
    expect(formatPnl(null, 2)).toBe('—')
  })

  it('shows the R multiple alone when risk-per-trade is unknown', () => {
    expect(formatPnl(2.5, null)).toBe('+2.50R')
  })

  it('appends the percentage (performance_r × risk_per_trade) in parentheses', () => {
    expect(formatPnl(2.5, 2)).toBe('+2.50R (+5.00%)')
    expect(formatPnl(-1, 2)).toBe('-1.00R (-2.00%)')
  })

  it('keeps both parts locale-aware', async () => {
    await i18n.changeLanguage('de')
    expect(formatPnl(2.5, 2)).toBe('+2,50R (+5,00%)')
  })
})

describe('formatPercent', () => {
  it('prefixes a plus sign on gains, none on zero', () => {
    expect(formatPercent(5)).toBe('+5.00%')
    expect(formatPercent(0)).toBe('0.00%')
  })

  it('keeps the minus sign on losses', () => {
    expect(formatPercent(-2.5)).toBe('-2.50%')
  })
})

describe('formatR', () => {
  it('returns an em dash for null', () => {
    expect(formatR(null)).toBe('—')
  })

  it('appends an R suffix with a signed, locale-aware value', async () => {
    await i18n.changeLanguage('en')
    expect(formatR(1.5)).toBe('+1.50R')

    await i18n.changeLanguage('de')
    expect(formatR(-1.5)).toBe('-1,50R')
  })
})

describe('formatLocalDate', () => {
  it('returns an em dash for empty values', () => {
    expect(formatLocalDate(null)).toBe('—')
    expect(formatLocalDate('')).toBe('—')
  })

  it('formats the long date in the active dayjs locale', () => {
    dayjs.locale('en')
    expect(formatLocalDate('2024-01-15')).toBe('January 15, 2024')

    dayjs.locale('fr')
    expect(formatLocalDate('2024-01-15')).toBe('15 janvier 2024')

    dayjs.locale('de')
    expect(formatLocalDate('2024-01-15')).toBe('15. Januar 2024')
  })

  it('honours an explicit format string', () => {
    dayjs.locale('en')
    expect(formatLocalDate('2024-01-15', 'YYYY-MM-DD')).toBe('2024-01-15')
  })
})
