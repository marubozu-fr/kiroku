import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDebouncedValue } from '@mantine/hooks'
import type { AnalyticsFilters } from '@/types/analytics'

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: AnalyticsFilters = {
  include_missed: false,
}

// ---------------------------------------------------------------------------
// URL serialization — mirrors filtersToParams in services/analytics.ts
// ---------------------------------------------------------------------------

function filtersToSearchParams(filters: AnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.asset_ids && filters.asset_ids.length > 0) {
    params.set('asset_ids', filters.asset_ids.join(','))
  }
  if (filters.direction) params.set('direction', filters.direction)
  if (filters.entry_timeframe && filters.entry_timeframe.length > 0) {
    params.set('entry_timeframe', filters.entry_timeframe.join(','))
  }
  if (filters.tag_ids && filters.tag_ids.length > 0) {
    params.set('tag_ids', filters.tag_ids.join(','))
  }
  if (filters.tags_logic) params.set('tags_logic', filters.tags_logic)
  if (filters.emotion_ids && filters.emotion_ids.length > 0) {
    params.set('emotion_ids', filters.emotion_ids.join(','))
  }
  if (filters.types && filters.types.length > 0) {
    params.set('types', filters.types.join(','))
  }
  if (filters.include_missed !== undefined) {
    params.set('include_missed', String(filters.include_missed))
  }
  if (filters.pnl_operator) params.set('pnl_operator', filters.pnl_operator)
  if (filters.pnl_value !== undefined) params.set('pnl_value', String(filters.pnl_value))
  if (filters.duration_operator) params.set('duration_operator', filters.duration_operator)
  if (filters.duration_value !== undefined) {
    params.set('duration_value', String(filters.duration_value))
  }
  if (filters.duration_unit) params.set('duration_unit', filters.duration_unit)

  return params
}

// ---------------------------------------------------------------------------
// URL deserialization
// ---------------------------------------------------------------------------

function parseIds(value: string | null): number[] | undefined {
  if (!value) return undefined
  const ids = value
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n))
  return ids.length > 0 ? ids : undefined
}

function parseStrings(value: string | null): string[] | undefined {
  if (!value) return undefined
  const parts = value.split(',').filter(Boolean)
  return parts.length > 0 ? parts : undefined
}

function searchParamsToFilters(params: URLSearchParams): AnalyticsFilters {
  const filters: AnalyticsFilters = {}

  const dateFrom = params.get('date_from')
  if (dateFrom) filters.date_from = dateFrom

  const dateTo = params.get('date_to')
  if (dateTo) filters.date_to = dateTo

  const assetIds = parseIds(params.get('asset_ids'))
  if (assetIds) filters.asset_ids = assetIds

  const direction = params.get('direction')
  if (direction) filters.direction = direction

  const entryTimeframe = parseStrings(params.get('entry_timeframe'))
  if (entryTimeframe) filters.entry_timeframe = entryTimeframe

  const tagIds = parseIds(params.get('tag_ids'))
  if (tagIds) filters.tag_ids = tagIds

  const tagsLogic = params.get('tags_logic')
  if (tagsLogic === 'AND' || tagsLogic === 'OR') filters.tags_logic = tagsLogic

  const emotionIds = parseIds(params.get('emotion_ids'))
  if (emotionIds) filters.emotion_ids = emotionIds

  const types = parseStrings(params.get('types'))
  if (types) filters.types = types

  const includeMissed = params.get('include_missed')
  // Default is false; only write when present in URL
  filters.include_missed = includeMissed === 'true' ? true : false

  const pnlOperator = params.get('pnl_operator')
  if (pnlOperator === 'gte' || pnlOperator === 'lte') filters.pnl_operator = pnlOperator

  const pnlValue = params.get('pnl_value')
  if (pnlValue !== null) {
    const parsed = parseFloat(pnlValue)
    if (!isNaN(parsed)) filters.pnl_value = parsed
  }

  const durationOperator = params.get('duration_operator')
  if (durationOperator === 'gte' || durationOperator === 'lte') {
    filters.duration_operator = durationOperator
  }

  const durationValue = params.get('duration_value')
  if (durationValue !== null) {
    const parsed = parseFloat(durationValue)
    if (!isNaN(parsed)) filters.duration_value = parsed
  }

  const durationUnit = params.get('duration_unit')
  if (durationUnit === 'minutes' || durationUnit === 'hours' || durationUnit === 'days') {
    filters.duration_unit = durationUnit
  }

  return filters
}

// ---------------------------------------------------------------------------
// Active filter count
// ---------------------------------------------------------------------------

function countActiveFilters(filters: AnalyticsFilters): number {
  let count = 0

  if (filters.date_from) count++
  if (filters.date_to) count++
  if (filters.asset_ids && filters.asset_ids.length > 0) count++
  if (filters.direction) count++
  if (filters.entry_timeframe && filters.entry_timeframe.length > 0) count++
  if (filters.tag_ids && filters.tag_ids.length > 0) count++
  // tags_logic is not a standalone dimension — it modifies tags
  if (filters.emotion_ids && filters.emotion_ids.length > 0) count++
  if (filters.types && filters.types.length > 0) count++
  // include_missed: only active (non-default) when true
  if (filters.include_missed === true) count++
  if (filters.pnl_value !== undefined) count++
  if (filters.duration_value !== undefined) count++

  return count
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type FiltersAction =
  | { type: 'SET'; key: keyof AnalyticsFilters; value: AnalyticsFilters[keyof AnalyticsFilters] }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; filters: AnalyticsFilters }

function filtersReducer(state: AnalyticsFilters, action: FiltersAction): AnalyticsFilters {
  switch (action.type) {
    case 'SET':
      return { ...state, [action.key]: action.value }
    case 'RESET':
      return { ...DEFAULT_FILTERS }
    case 'HYDRATE':
      return { ...action.filters }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseAnalyticsFiltersResult {
  filters: AnalyticsFilters
  debouncedFilters: AnalyticsFilters
  setFilter: <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => void
  resetFilters: () => void
  activeFilterCount: number
}

export function useAnalyticsFilters(): UseAnalyticsFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams()

  // Hydrate initial state from URL on mount
  const [filters, dispatch] = useReducer(
    filtersReducer,
    undefined,
    () => searchParamsToFilters(searchParams),
  )

  const [debouncedFilters] = useDebouncedValue(filters, 300)

  // Sync debounced filters to URL — use a ref to avoid triggering the effect
  // on the initial render (which would overwrite URL params with defaults).
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const params = filtersToSearchParams(debouncedFilters)
    setSearchParams(params, { replace: true })
    // Only run when debouncedFilters changes; setSearchParams is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilters])

  const setFilter = useCallback(
    <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => {
      dispatch({ type: 'SET', key, value })
    },
    [],
  )

  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const activeFilterCount = countActiveFilters(filters)

  return { filters, debouncedFilters, setFilter, resetFilters, activeFilterCount }
}
