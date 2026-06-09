/**
 * Pure helpers for the trade form's entries/exits sub-sections and screenshot
 * staging. Kept separate from the page component so they can be unit-tested.
 */

/** A single entry or exit row as held in the form state. */
export interface ExecutionRow {
  date: string
  quantity: number | string
  price: number | string
}

/** Accepted screenshot MIME types — mirrors the backend's allow-list. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Maximum screenshot size in bytes (5 MB) — mirrors the backend limit. */
export const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024

/** True when a value is a finite number strictly greater than 0. */
export function isPositiveNumber(value: number | string): boolean {
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) && parsed > 0
}

/** Total quantity and quantity-weighted average price for a set of rows. */
export function executionTotals(rows: ExecutionRow[]): {
  quantity: number
  avgPrice: number | null
} {
  let quantity = 0
  let weighted = 0
  for (const row of rows) {
    const qty = Number(row.quantity)
    const price = Number(row.price)
    if (isPositiveNumber(qty) && Number.isFinite(price)) {
      quantity += qty
      weighted += qty * price
    }
  }
  return { quantity, avgPrice: quantity > 0 ? weighted / quantity : null }
}

/** Whether a staged file is an accepted image within the size limit. */
export function isValidScreenshot(file: File): boolean {
  return (
    (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type) &&
    file.size > 0 &&
    file.size <= MAX_SCREENSHOT_SIZE
  )
}
