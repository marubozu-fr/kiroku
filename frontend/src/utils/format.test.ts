import { describe, expect, it } from 'vitest'
import { formatAssetLabel } from './format'

describe('formatAssetLabel', () => {
  it('returns name/currency when both are provided', () => {
    expect(formatAssetLabel('NQ', 'USD')).toBe('NQ/USD')
  })

  it('returns just the name when currency is null', () => {
    expect(formatAssetLabel('NQ', null)).toBe('NQ')
  })

  it('returns just the name when currency is empty string', () => {
    expect(formatAssetLabel('NQ', '')).toBe('NQ')
  })

  it('returns em dash when name is null', () => {
    expect(formatAssetLabel(null, 'USD')).toBe('—')
  })

  it('returns em dash when name is null and currency is null', () => {
    expect(formatAssetLabel(null, null)).toBe('—')
  })

  it('returns em dash when name is empty string', () => {
    expect(formatAssetLabel('', 'USD')).toBe('—')
  })

  it('returns em dash when both name and currency are empty strings', () => {
    expect(formatAssetLabel('', '')).toBe('—')
  })

  it('returns name/currency for a typical forex pair', () => {
    expect(formatAssetLabel('EUR', 'USD')).toBe('EUR/USD')
  })

  it('returns name only for an asset without currency', () => {
    expect(formatAssetLabel('AAPL', null)).toBe('AAPL')
  })
})
