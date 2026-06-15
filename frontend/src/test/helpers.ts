import { expect } from 'vitest'

/**
 * Asserts a value is defined and narrows the type for subsequent code.
 * Use in tests instead of the verbose `expect(x).toBeDefined(); if (x != null)` pattern.
 */
export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  expect(value, message).toBeDefined()
}
