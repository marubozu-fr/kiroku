import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import type { AnalyticsFilters, AvailableFilters } from '@/types/analytics'
import { FilterPanel } from './FilterPanel'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AVAILABLE_FILTERS: AvailableFilters = {
  assets: [
    { id: 1, name: 'EUR/USD', currency: 'USD' },
    { id: 2, name: 'GBP/USD', currency: 'USD' },
  ],
  directions: ['long', 'short'],
  timeframes: ['15m', '1h', '4h'],
  tags: [
    { id: 10, name: 'Breakout' },
    { id: 11, name: 'Reversal' },
  ],
  emotions: [
    { id: 20, name: 'FOMO' },
    { id: 21, name: 'Calm' },
  ],
  types: ['live', 'demo', 'test'],
  date_range: { min: '2026-01-01', max: '2026-06-30' },
}

const DEFAULT_FILTERS: AnalyticsFilters = {
  include_missed: false,
}

function makeProps(overrides: Partial<AnalyticsFilters> = {}) {
  const filters: AnalyticsFilters = { ...DEFAULT_FILTERS, ...overrides }
  const setFilter = vi.fn()
  const resetFilters = vi.fn()

  return {
    availableFilters: AVAILABLE_FILTERS,
    filters,
    setFilter,
    resetFilters,
    activeFilterCount: 0,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterPanel', () => {
  it('renders the panel title', () => {
    renderWithProviders(<FilterPanel {...makeProps()} />)
    // Title text appears in multiple places (title + toggle button); use getAllByText.
    const matches = screen.getAllByText('Filters')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the direction segmented control with Long/Short', () => {
    renderWithProviders(<FilterPanel {...makeProps()} />)

    // Use getAllByRole since "All" appears in multiple SegmentedControls.
    const longRadio = screen.getByRole('radio', { name: 'Long' })
    const shortRadio = screen.getByRole('radio', { name: 'Short' })
    expect(longRadio).toBeInTheDocument()
    expect(shortRadio).toBeInTheDocument()
  })

  it('renders account type segmented control with Live/Demo/Test', () => {
    renderWithProviders(<FilterPanel {...makeProps()} />)

    expect(screen.getByRole('radio', { name: 'Live' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Demo' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Test' })).toBeInTheDocument()
  })

  it('renders the missed opportunities switch', () => {
    renderWithProviders(<FilterPanel {...makeProps()} />)
    expect(screen.getByText('Missed opportunities')).toBeInTheDocument()
  })

  it('renders the AND/OR tags logic segmented control', () => {
    renderWithProviders(<FilterPanel {...makeProps()} />)
    expect(screen.getByRole('radio', { name: 'AND' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'OR' })).toBeInTheDocument()
  })

  it('renders the reset button when activeFilterCount > 0', () => {
    renderWithProviders(
      <FilterPanel {...makeProps()} activeFilterCount={2} />,
    )
    expect(screen.getByRole('button', { name: 'Reset all' })).toBeInTheDocument()
  })

  it('does not render the reset button when activeFilterCount is 0', () => {
    renderWithProviders(<FilterPanel {...makeProps()} activeFilterCount={0} />)
    expect(screen.queryByRole('button', { name: 'Reset all' })).not.toBeInTheDocument()
  })

  it('calls resetFilters when reset button is clicked', () => {
    const props = makeProps()
    renderWithProviders(<FilterPanel {...props} activeFilterCount={1} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }))

    expect(props.resetFilters).toHaveBeenCalledTimes(1)
  })

  it('calls setFilter with direction when Long radio is clicked', () => {
    const props = makeProps()
    renderWithProviders(<FilterPanel {...props} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Long' }))

    expect(props.setFilter).toHaveBeenCalledWith('direction', 'long')
  })

  it('calls setFilter with undefined direction when direction All is clicked', () => {
    const props = makeProps({ direction: 'long' })
    renderWithProviders(<FilterPanel {...props} />)

    // Direction "All" radio — there are multiple "All" radios (direction + account_type)
    // Find them by radio name and click the first one (direction group).
    const allRadios = screen.getAllByRole('radio', { name: 'All' })
    fireEvent.click(allRadios[0])

    expect(props.setFilter).toHaveBeenCalledWith('direction', undefined)
  })

  it('calls setFilter with types array when account type radio is clicked', () => {
    const props = makeProps()
    renderWithProviders(<FilterPanel {...props} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Live' }))

    expect(props.setFilter).toHaveBeenCalledWith('types', ['live'])
  })

  it('calls setFilter with tags_logic when OR is toggled', () => {
    const props = makeProps()
    renderWithProviders(<FilterPanel {...props} />)

    fireEvent.click(screen.getByRole('radio', { name: 'OR' }))

    expect(props.setFilter).toHaveBeenCalledWith('tags_logic', 'OR')
  })

  it('calls setFilter with include_missed true when switch is toggled on', () => {
    const props = makeProps({ include_missed: false })
    renderWithProviders(<FilterPanel {...props} />)

    // Mantine Switch renders as role="switch"
    const switchEl = screen.getByRole('switch')
    fireEvent.click(switchEl)

    expect(props.setFilter).toHaveBeenCalledWith('include_missed', true)
  })

  it('missed switch is off by default (include_missed false)', () => {
    renderWithProviders(<FilterPanel {...makeProps()} />)

    const switchEl = screen.getByRole('switch')
    expect(switchEl).not.toBeChecked()
  })

  it('missed switch is on when include_missed is true', () => {
    renderWithProviders(<FilterPanel {...makeProps({ include_missed: true })} />)

    const switchEl = screen.getByRole('switch')
    expect(switchEl).toBeChecked()
  })

  it('renders section labels for P&L and Duration', () => {
    renderWithProviders(<FilterPanel {...makeProps()} />)

    expect(screen.getByText('P&L (R)')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
  })
})
