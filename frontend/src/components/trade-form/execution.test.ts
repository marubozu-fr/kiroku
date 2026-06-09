import { describe, expect, it } from 'vitest'
import {
  executionTotals,
  isPositiveNumber,
  isValidScreenshot,
  MAX_SCREENSHOT_SIZE,
} from '@/components/trade-form/execution'

describe('isPositiveNumber', () => {
  it('accepts finite positive numbers and numeric strings', () => {
    expect(isPositiveNumber(5)).toBe(true)
    expect(isPositiveNumber('1.5')).toBe(true)
  })

  it('rejects zero, negatives, empty and non-numeric values', () => {
    expect(isPositiveNumber(0)).toBe(false)
    expect(isPositiveNumber(-2)).toBe(false)
    expect(isPositiveNumber('')).toBe(false)
    expect(isPositiveNumber('abc')).toBe(false)
  })
})

describe('executionTotals', () => {
  it('returns zero quantity and null avg for empty rows', () => {
    expect(executionTotals([])).toEqual({ quantity: 0, avgPrice: null })
  })

  it('computes total quantity and quantity-weighted average price', () => {
    const totals = executionTotals([
      { date: '', quantity: 10000, price: 1.081 },
      { date: '', quantity: 5000, price: 1.0806 },
    ])
    expect(totals.quantity).toBe(15000)
    // (10000*1.081 + 5000*1.0806) / 15000 = 1.08086...
    expect(totals.avgPrice).toBeCloseTo(1.080866, 5)
  })

  it('ignores rows with missing or invalid quantity / price', () => {
    const totals = executionTotals([
      { date: '', quantity: '', price: '' },
      { date: '', quantity: 1000, price: 2 },
    ])
    expect(totals.quantity).toBe(1000)
    expect(totals.avgPrice).toBe(2)
  })
})

describe('isValidScreenshot', () => {
  const makeFile = (type: string, size: number): File => {
    const file = new File(['x'], 'shot', { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  it('accepts JPG/PNG/WebP within the size limit', () => {
    expect(isValidScreenshot(makeFile('image/jpeg', 1024))).toBe(true)
    expect(isValidScreenshot(makeFile('image/png', 1024))).toBe(true)
    expect(isValidScreenshot(makeFile('image/webp', 1024))).toBe(true)
  })

  it('rejects other types, empty files, and files over 5 MB', () => {
    expect(isValidScreenshot(makeFile('application/pdf', 1024))).toBe(false)
    expect(isValidScreenshot(makeFile('image/gif', 1024))).toBe(false)
    expect(isValidScreenshot(makeFile('image/png', 0))).toBe(false)
    expect(isValidScreenshot(makeFile('image/png', MAX_SCREENSHOT_SIZE + 1))).toBe(false)
  })
})
