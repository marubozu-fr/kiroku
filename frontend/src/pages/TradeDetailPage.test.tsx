import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TradeDetailPage } from '@/pages/TradeDetailPage'
import type { Asset } from '@/types/referenceData'
import type { TradeDetail } from '@/types/trade'
import { jsonResponse, renderWithProviders } from '@/test/utils'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const asset: Asset = {
  id: 1,
  name: 'EUR/USD',
  category: 'Forex',
  currency: 'USD',
  is_active: true,
  created_at: null,
  updated_at: null,
}

function makeTrade(overrides: Partial<TradeDetail> = {}): TradeDetail {
  return {
    id: 1,
    asset_id: 1,
    account_type: 'live',
    status: 'Closed',
    direction: 'Long',
    stop_loss: null,
    notes: null,
    missed_opportunity: false,
    risk_per_trade: null,
    avg_entry_price: null,
    avg_exit_price: null,
    risk: null,
    reward: null,
    performance_r: 1.5,
    timeframe_unit: null,
    timeframe_value: null,
    trade_date: '2026-03-04',
    created_at: null,
    updated_at: null,
    activities: [],
    tags: [],
    emotions: [],
    screenshots: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Stub helper
// ---------------------------------------------------------------------------

/**
 * Route a mocked fetch by path and method to the right API envelope.
 * DELETE requests always return a success envelope with the trade.
 */
function stubApi(trade: TradeDetail, assets: Asset[] = [asset]) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'

    if (method === 'DELETE' && input.startsWith('/api/trades/')) {
      return jsonResponse(trade)
    }
    if (input.startsWith(`/api/trades/${trade.id}`)) {
      return jsonResponse(trade)
    }
    if (input.startsWith('/api/assets')) {
      return jsonResponse(assets)
    }
    throw new Error(`Unexpected fetch: ${method} ${input}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function stubApiNotFound(tradeId: number) {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.startsWith(`/api/trades/${tradeId}`)) {
      return jsonResponse(null, {
        ok: false,
        status: 404,
        error: `Trade ${tradeId} not found`,
      })
    }
    if (input.startsWith('/api/assets')) {
      return jsonResponse([asset])
    }
    throw new Error(`Unexpected fetch: ${input}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function stubApiError(message: string) {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.startsWith('/api/trades/')) {
      return jsonResponse(null, { ok: false, status: 500, error: message })
    }
    if (input.startsWith('/api/assets')) {
      return jsonResponse([asset])
    }
    throw new Error(`Unexpected fetch: ${input}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderDetail(tradeId = 1) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/journal/${tradeId}`]}>
      <Routes>
        <Route path="/journal/:id" element={<TradeDetailPage />} />
        <Route path="/journal" element={<div>Journal list</div>} />
        <Route path="/journal/:id/edit" element={<div>Edit form</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TradeDetailPage', () => {
  it('renders the populated trade with asset name, badges and P&L', async () => {
    stubApi(makeTrade({ performance_r: 1.5, risk_per_trade: 2, asset_id: 1 }))
    renderDetail()

    // Asset name resolved from assets list
    expect(await screen.findByText('EUR/USD')).toBeInTheDocument()

    // Direction and status badges
    expect(screen.getByText('Long')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()

    // P&L shown as the R multiple with the equivalent percentage
    expect(screen.getByText('+1.50R (+3.00%)')).toBeInTheDocument()
  })

  it('displays the stop loss metric', async () => {
    stubApi(makeTrade({ stop_loss: 1.075 }))
    renderDetail()

    await screen.findByText('EUR/USD')
    expect(screen.getByText('Stop Loss').parentElement).toHaveTextContent('1.0750')
  })

  it('shows "Open" for the duration when the trade is not closed', async () => {
    stubApi(makeTrade({ status: 'Open' }))
    renderDetail()

    await screen.findByText('EUR/USD')
    // The status badge also reads "Open", so scope to the Duration metric.
    expect(screen.getByText('Duration').parentElement).toHaveTextContent('Open')
  })

  it('renders tags, emotions, notes, and activities', async () => {
    const trade = makeTrade({
      notes: 'Great setup, followed the plan.',
      tags: [
        {
          id: 10,
          name: 'Trend-following',
          description: null,
          is_active: true,
          created_at: null,
          updated_at: null,
        },
      ],
      emotions: [
        {
          id: 20,
          name: 'Focused',
          description: null,
          severity: 'Good',
          category: 'Emotional State',
          created_at: null,
          updated_at: null,
        },
      ],
      activities: [
        {
          id: 30,
          trade_id: 1,
          type: 'Buy',
          price: 1.0825,
          quantity: 10000,
          date: '2026-03-04T09:00:00Z',
          is_entry: true,
        },
        {
          id: 31,
          trade_id: 1,
          type: 'Sell',
          price: 1.0950,
          quantity: 10000,
          date: '2026-03-04T15:30:00Z',
          is_entry: false,
        },
      ],
    })

    stubApi(trade)
    renderDetail()

    // Wait for the page to load
    expect(await screen.findByText('EUR/USD')).toBeInTheDocument()

    // Tag
    expect(screen.getByText('Trend-following')).toBeInTheDocument()

    // Emotion name and its category header
    expect(screen.getByText('Focused')).toBeInTheDocument()
    expect(screen.getByText('Emotional State')).toBeInTheDocument()

    // Notes text
    expect(screen.getByText('Great setup, followed the plan.')).toBeInTheDocument()

    // Activity type badges (Buy entry, Sell exit) appear in the entries/exits
    // summary and again in the per-activity timeline.
    expect(screen.getAllByText('Buy').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sell').length).toBeGreaterThan(0)
  })

  it('shows the account type badge and entries/exits totals', async () => {
    const trade = makeTrade({
      account_type: 'demo',
      avg_entry_price: 1.081,
      avg_exit_price: 1.0948,
      activities: [
        {
          id: 30,
          trade_id: 1,
          type: 'Buy',
          price: 1.081,
          quantity: 10000,
          date: '2026-03-04T09:00:00Z',
          is_entry: true,
        },
        {
          id: 31,
          trade_id: 1,
          type: 'Sell',
          price: 1.0948,
          quantity: 10000,
          date: '2026-03-04T15:30:00Z',
          is_entry: false,
        },
      ],
    })

    stubApi(trade)
    renderDetail()

    await screen.findByText('EUR/USD')
    expect(screen.getByText('Demo')).toBeInTheDocument()
    // Weighted-average entry / exit prices, monospace with 5 decimals.
    expect(screen.getByText('1.08100')).toBeInTheDocument()
    expect(screen.getByText('1.09480')).toBeInTheDocument()
  })

  it('renders screenshot group label and thumbnail image', async () => {
    const trade = makeTrade({
      screenshots: [
        {
          id: 50,
          trade_id: 1,
          filename: 'chart_15m.png',
          timeframe_value: 15,
          timeframe_unit: 'm',
          created_at: null,
        },
      ],
    })

    stubApi(trade)
    renderDetail()

    // Wait for the page to load
    expect(await screen.findByText('EUR/USD')).toBeInTheDocument()

    // Timeframe group label
    expect(screen.getByText('15m')).toBeInTheDocument()

    // Thumbnail image
    const img = screen.getByRole('img', { name: 'chart_15m.png' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/api/screenshots/chart_15m.png')
  })

  it('opens lightbox modal when thumbnail is clicked', async () => {
    const trade = makeTrade({
      screenshots: [
        {
          id: 50,
          trade_id: 1,
          filename: 'chart_15m.png',
          timeframe_value: 15,
          timeframe_unit: 'm',
          created_at: null,
        },
      ],
    })

    stubApi(trade)
    renderDetail()

    await screen.findByText('EUR/USD')

    // Click the thumbnail
    fireEvent.click(screen.getByRole('img', { name: 'chart_15m.png' }))

    // Lightbox modal should open — the modal title is the filename
    expect(await screen.findByText('chart_15m.png')).toBeInTheDocument()
  })

  it('calls DELETE and navigates to journal list on delete confirmation', async () => {
    const trade = makeTrade()
    const fetchMock = stubApi(trade)
    renderDetail()

    // Wait for trade to load
    await screen.findByText('EUR/USD')

    // Click the top-level Delete button (the action button)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])

    // Confirm modal should open
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    // Click the confirm Delete button inside the modal
    const confirmDeleteButton = screen
      .getAllByRole('button', { name: /delete/i })
      .find((btn) => btn.closest('[role="dialog"]') !== null)
    expect(confirmDeleteButton).toBeDefined()
    fireEvent.click(confirmDeleteButton!)

    // Assert DELETE was called on the correct endpoint
    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        ([input, init]: [string, RequestInit?]) =>
          (init?.method ?? 'GET') === 'DELETE' && input === '/api/trades/1',
      )
      expect(deleteCalls.length).toBeGreaterThan(0)
    })

    // Assert navigation to journal list
    expect(await screen.findByText('Journal list')).toBeInTheDocument()
  })

  it('renders "Trade not found" when the API returns a 404 error', async () => {
    stubApiNotFound(99)
    renderDetail(99)

    expect(await screen.findByText('Trade not found')).toBeInTheDocument()
  })

  it('renders the error message and a Retry button on a 500 error', async () => {
    const fetchMock = stubApiError('Internal server error')
    renderDetail()

    expect(await screen.findByText('Internal server error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

    // Click Retry and assert fetch is called again
    fetchMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })
})
