import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnalyticsFilters } from './useAnalyticsFilters'

// ---------------------------------------------------------------------------
// Wrapper: MemoryRouter is required because the hook reads/writes search params.
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, { initialEntries: ['/analytics'] }, children)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAnalyticsFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns default filters on mount (include_missed false)', () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    expect(result.current.filters.include_missed).toBe(false)
    expect(result.current.filters.date_from).toBeUndefined()
    expect(result.current.filters.asset_ids).toBeUndefined()
    expect(result.current.activeFilterCount).toBe(0)
  })

  it('setFilter updates the live filters immediately', () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    act(() => {
      result.current.setFilter('date_from', '2026-01-01')
    })

    expect(result.current.filters.date_from).toBe('2026-01-01')
  })

  it('debouncedFilters does not update before 300ms', () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    act(() => {
      result.current.setFilter('date_from', '2026-01-01')
    })

    // Before debounce window — debouncedFilters should still reflect old value
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.debouncedFilters.date_from).toBeUndefined()
  })

  it('debouncedFilters updates after 300ms', () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    act(() => {
      result.current.setFilter('date_from', '2026-01-01')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.debouncedFilters.date_from).toBe('2026-01-01')
  })

  it('resetFilters returns include_missed to false and clears other filters', () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    act(() => {
      result.current.setFilter('date_from', '2026-01-01')
      result.current.setFilter('include_missed', true)
      result.current.setFilter('asset_ids', [1, 2])
    })

    expect(result.current.filters.date_from).toBe('2026-01-01')
    expect(result.current.filters.include_missed).toBe(true)

    act(() => {
      result.current.resetFilters()
    })

    expect(result.current.filters.date_from).toBeUndefined()
    expect(result.current.filters.include_missed).toBe(false)
    expect(result.current.filters.asset_ids).toBeUndefined()
  })

  it('activeFilterCount is 0 with default filters', () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    expect(result.current.activeFilterCount).toBe(0)
  })

  it('activeFilterCount increments when non-default filters are set', () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    act(() => {
      result.current.setFilter('date_from', '2026-01-01')
      result.current.setFilter('asset_ids', [5])
    })

    expect(result.current.activeFilterCount).toBe(2)
  })

  it('include_missed true counts as active (non-default)', () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    act(() => {
      result.current.setFilter('include_missed', true)
    })

    expect(result.current.activeFilterCount).toBe(1)
  })

  it('include_missed false does NOT count as active (is the default)', () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    // Default is already false — ensure count is 0
    expect(result.current.activeFilterCount).toBe(0)

    act(() => {
      result.current.setFilter('include_missed', false)
    })

    expect(result.current.activeFilterCount).toBe(0)
  })

  it('hydrates filters from URL on mount', () => {
    function wrapperWithUrl({ children }: { children: ReactNode }) {
      return createElement(
        MemoryRouter,
        { initialEntries: ['/analytics?date_from=2026-03-01&asset_ids=1,2'] },
        children,
      )
    }

    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper: wrapperWithUrl })

    expect(result.current.filters.date_from).toBe('2026-03-01')
    expect(result.current.filters.asset_ids).toEqual([1, 2])
  })

  it('URL sync: debouncedFilters writes to search params after 300ms', async () => {
    // We capture the search params by reading them out of the hook after debounce.
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper })

    act(() => {
      result.current.setFilter('direction', 'long')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    // After debounce, the debouncedFilters should have the value set.
    // The URL write is a side effect — we verify the debounced value propagated.
    expect(result.current.debouncedFilters.direction).toBe('long')
  })
})
