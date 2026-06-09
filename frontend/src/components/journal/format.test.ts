import { afterEach, describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import i18n from '@/i18n'

// Statically load the locales the date tests assert against. The app loads
// these lazily (see @/i18n), but tests need them available synchronously.
import 'dayjs/locale/fr'
import 'dayjs/locale/de'

import { formatLocalDate, formatPnl, formatR } from './format'

afterEach(async () => {
  await i18n.changeLanguage('en')
  dayjs.locale('en')
})

describe('formatPnl', () => {
  it('returns an em dash for null', () => {
    expect(formatPnl(null)).toBe('—')
  })

  it('prefixes a plus sign on gains, none on zero', () => {
    expect(formatPnl(125)).toBe('+125.00')
    expect(formatPnl(0)).toBe('0.00')
  })

  it('keeps the minus sign on losses', () => {
    expect(formatPnl(-42.5)).toBe('-42.50')
  })

  it('groups thousands using the active locale', async () => {
    await i18n.changeLanguage('en')
    expect(formatPnl(1234.56)).toBe('+1,234.56')

    await i18n.changeLanguage('de')
    expect(formatPnl(1234.56)).toBe('+1.234,56')
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
