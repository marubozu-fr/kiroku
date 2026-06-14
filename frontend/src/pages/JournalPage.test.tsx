import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JournalPage } from '@/pages/JournalPage'
import type { Asset } from '@/types/referenceData'
import type { TradeSummary } from '@/types/trade'
import { jsonResponse, renderWithProviders } from '@/test/utils'

function trade(overrides: Partial<TradeSummary> = {}): TradeSummary {
  return {
    id: 1,
    asset_id: 1,
    account_type: 'live',
    status: 'Closed',
    direction: 'Long',
    stop_loss: null,
    notes: null,
    missed_opportunity: false,
    risk_per_trade: 2,
    avg_entry_price: null,
    avg_exit_price: null,
    risk: null,
    reward: null,
    performance_r: 1.5,
    timeframe_unit: null,
    timeframe_value: null,
    trade_date: '2026-06-04T08:00:00.000Z',
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

const asset: Asset = {
  id: 1,
  name: 'EUR',
  category: 'Forex',
  currency: 'USD',
  is_active: true,
  created_at: null,
  updated_at: null,
}

const assetGbp: Asset = { ...asset, id: 2, name: 'GBP' }
const assetJpy: Asset = { ...asset, id: 3, name: 'JPY' }

/** Route a mocked fetch by path to the right API envelope. */
function stubApi(handlers: {
  years?: number[]
  assets?: Asset[]
  trades?: (year: number) => TradeSummary[]
}) {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.startsWith('/api/trades/years')) {
      return jsonResponse(handlers.years ?? [])
    }
    if (input.startsWith('/api/trades')) {
      const year = Number(new URL(input, 'http://x').searchParams.get('year'))
      return jsonResponse(handlers.trades ? handlers.trades(year) : [])
    }
    if (input.startsWith('/api/assets')) {
      return jsonResponse(handlers.assets ?? [])
    }
    throw new Error(`Unexpected fetch: ${input}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderJournal() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/journal']}>
      <Routes>
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/journal/:id" element={<div>Trade detail</div>} />
        <Route path="/journal/new" element={<div>New trade form</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('JournalPage', () => {
  it('loads and displays trades in calendar view by default', async () => {
    stubApi({
      years: [2026],
      assets: [asset],
      trades: () => [trade()],
    })

    renderJournal()

    // Calendar default: the trade event shows "HH:mm ASSET: R".
    // Both desktop grid and mobile agenda render the same event, so use findAllByText.
    const events = await screen.findAllByText(/EUR\/USD/)
    expect(events.length).toBeGreaterThanOrEqual(1)
  })

  it('shows stat cards when trades are loaded', async () => {
    stubApi({
      years: [2026],
      assets: [asset],
      trades: () => [trade()],
    })

    renderJournal()

    expect(await screen.findByText('Total Trades')).toBeInTheDocument()
    expect(screen.getByText('Win Rate')).toBeInTheDocument()
  })

  it('shows the list view with full trade row after switching to list', async () => {
    stubApi({
      years: [2026],
      assets: [asset],
      trades: () => [trade()],
    })

    renderJournal()

    // Wait for data to load.
    await screen.findByText('Total Trades')

    // Switch to list view.
    fireEvent.click(screen.getByRole('radio', { name: 'List' }))

    expect(await screen.findByText('EUR/USD')).toBeInTheDocument()
    expect(screen.getByText('Long')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('+1.50R (+3.00%)')).toBeInTheDocument()
  })

  it('shows the empty state when a year has no trades', async () => {
    stubApi({ years: [2026], assets: [asset], trades: () => [] })

    renderJournal()

    expect(await screen.findByText(/no trades for 2026/i)).toBeInTheDocument()
  })

  it('still renders the calendar when a year has no trades', async () => {
    stubApi({ years: [2026], assets: [asset], trades: () => [] })

    renderJournal()

    // The empty-state banner no longer replaces the calendar: the month header
    // and weekday grid render so news events remain visible without any trades.
    expect(await screen.findByText(/no trades for 2026/i)).toBeInTheDocument()
    expect((await screen.findAllByText('June 2026')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Mon').length).toBeGreaterThanOrEqual(1)
  })

  it('reloads trades when the year changes', async () => {
    stubApi({
      years: [2025, 2026],
      assets: [asset],
      trades: (year) =>
        year === 2025 ? [trade({ id: 9, asset_id: 1, trade_date: '2025-07-01T08:00:00.000Z' })] : [],
    })

    renderJournal()

    // 2026 selected by default → empty.
    expect(await screen.findByText(/no trades for 2026/i)).toBeInTheDocument()

    // Mantine Select opens a dropdown on click; pick 2025 from it.
    fireEvent.click(screen.getByRole('textbox', { name: 'Year' }))
    fireEvent.click(await screen.findByText('2025'))

    // After switching to 2025, stats appear.
    expect(await screen.findByText('Total Trades')).toBeInTheDocument()
  })

  it('navigates to the trade detail page on calendar event click', async () => {
    stubApi({ years: [2026], assets: [asset], trades: () => [trade()] })

    renderJournal()

    // Both desktop and mobile render the same link; click the first one.
    const eventLinks = await screen.findAllByRole('link', { name: /EUR\/USD/ })
    fireEvent.click(eventLinks[0])

    expect(await screen.findByText('Trade detail')).toBeInTheDocument()
  })

  it('navigates to trade detail on list row click', async () => {
    stubApi({ years: [2026], assets: [asset], trades: () => [trade()] })

    renderJournal()

    // Switch to list view.
    await screen.findByText('Total Trades')
    fireEvent.click(screen.getByRole('radio', { name: 'List' }))

    fireEvent.click(await screen.findByText('EUR/USD'))

    expect(await screen.findByText('Trade detail')).toBeInTheDocument()
  })

  it('shows an error state with retry when trades fail to load', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.startsWith('/api/trades/years')) {
        return jsonResponse([2026])
      }
      if (input.startsWith('/api/trades')) {
        return jsonResponse(null, { ok: false, status: 500, error: 'Boom' })
      }
      return jsonResponse([asset])
    })
    vi.stubGlobal('fetch', fetchMock)

    renderJournal()

    expect(await screen.findByText('Boom')).toBeInTheDocument()
    fetchMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })
})

describe('JournalPage account-type toggles', () => {
  // Live (EUR), demo (GBP) and test (JPY) trades in the displayed month.
  function stubMixed() {
    return stubApi({
      years: [2026],
      assets: [asset, assetGbp, assetJpy],
      trades: () => [
        trade({ id: 1, account_type: 'live', asset_id: 1, trade_date: '2026-06-04T08:00:00.000Z' }),
        trade({ id: 2, account_type: 'demo', asset_id: 2, trade_date: '2026-06-05T08:00:00.000Z' }),
        trade({ id: 3, account_type: 'test', asset_id: 3, trade_date: '2026-06-06T08:00:00.000Z' }),
      ],
    })
  }

  it('shows only live trades by default; demo and test are hidden', async () => {
    stubMixed()
    renderJournal()

    expect((await screen.findAllByText(/EUR\/USD/)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/GBP\/USD/)).not.toBeInTheDocument()
    expect(screen.queryByText(/JPY\/USD/)).not.toBeInTheDocument()
  })

  it('reveals demo trades when the Demo chip is toggled on, leaving stats live-only', async () => {
    stubMixed()
    renderJournal()
    await screen.findAllByText(/EUR\/USD/)

    // Stats are computed from live only — one trade before and after the toggle.
    const statsCard = screen.getByText('Total Trades').closest('.mantine-Card-root') as HTMLElement
    expect(within(statsCard).getByText('1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Demo' }))

    expect((await screen.findAllByText(/GBP\/USD/)).length).toBeGreaterThan(0)
    // Test still hidden; stats unchanged.
    expect(screen.queryByText(/JPY\/USD/)).not.toBeInTheDocument()
    expect(within(statsCard).getByText('1')).toBeInTheDocument()
  })

  it('reveals test trades when the Test chip is toggled on', async () => {
    stubMixed()
    renderJournal()
    await screen.findAllByText(/EUR\/USD/)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Test' }))

    expect((await screen.findAllByText(/JPY\/USD/)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/GBP\/USD/)).not.toBeInTheDocument()
  })

  it('hides demo trades again when the Demo chip is toggled off', async () => {
    stubMixed()
    renderJournal()
    await screen.findAllByText(/EUR\/USD/)

    const demoChip = screen.getByRole('checkbox', { name: 'Demo' })
    fireEvent.click(demoChip)
    await screen.findAllByText(/GBP\/USD/)

    fireEvent.click(demoChip)
    await waitFor(() => expect(screen.queryByText(/GBP\/USD/)).not.toBeInTheDocument())
  })

  it('cannot deselect the locked Live chip', async () => {
    stubMixed()
    renderJournal()
    await screen.findAllByText(/EUR\/USD/)

    const liveChip = screen.getByRole('checkbox', { name: 'Live' })
    expect(liveChip).toBeChecked()

    // Clicking Live cannot turn it off — handleChange re-adds it.
    fireEvent.click(liveChip)
    expect(liveChip).toBeChecked()
    // Live trades remain visible.
    expect((await screen.findAllByText(/EUR\/USD/)).length).toBeGreaterThan(0)
  })

  it('renders the Account column with badges in the list view', async () => {
    stubMixed()
    renderJournal()
    await screen.findByText('Total Trades')

    fireEvent.click(screen.getByRole('radio', { name: 'List' }))

    // Live row present; demo/test rows hidden by default.
    expect(await screen.findByText('EUR/USD')).toBeInTheDocument()
    expect(screen.queryByText('GBP/USD')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Demo' }))
    expect(await screen.findByText('GBP/USD')).toBeInTheDocument()

    // The demo row carries a "Demo" account badge (the chip label also reads
    // "Demo", so assert at least the badge is present in addition).
    const demoBadges = screen.getAllByText('Demo')
    expect(demoBadges.length).toBeGreaterThan(1)
  })
})
