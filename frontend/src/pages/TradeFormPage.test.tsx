import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TradeFormPage } from '@/pages/TradeFormPage'
import type { Asset, Emotion, Tag } from '@/types/referenceData'
import type { TradeDetail } from '@/types/trade'
import { jsonResponse, renderWithProviders } from '@/test/utils'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const assets: Asset[] = [
  {
    id: 1,
    name: 'EUR/USD',
    category: 'Forex',
    currency: 'USD',
    is_active: true,
    created_at: null,
    updated_at: null,
  },
  {
    id: 2,
    name: 'Retired pair',
    category: 'Forex',
    currency: 'USD',
    is_active: false,
    created_at: null,
    updated_at: null,
  },
]

const tags: Tag[] = [
  {
    id: 10,
    name: 'Breakout',
    description: null,
    is_active: true,
    created_at: null,
    updated_at: null,
  },
]

const emotionsGrouped: Record<string, Emotion[]> = {
  'Emotional State': [
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
}

function makeTrade(overrides: Partial<TradeDetail> = {}): TradeDetail {
  return {
    id: 1,
    asset_id: 1,
    status: 'Closed',
    direction: 'Long',
    stop_loss: 1.07,
    notes: 'Followed the plan.',
    missed_opportunity: false,
    risk_per_trade: 1.5,
    avg_entry_price: null,
    avg_exit_price: null,
    risk: null,
    reward: null,
    performance_r: null,
    realized_pnl: null,
    timeframe_unit: 'm',
    timeframe_value: 15,
    trade_date: '2026-03-04',
    created_at: null,
    updated_at: null,
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
        price: 1.095,
        quantity: 10000,
        date: '2026-03-04T15:30:00Z',
        is_entry: false,
      },
    ],
    tags: [tags[0]],
    emotions: [emotionsGrouped['Emotional State'][0]],
    screenshots: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Fetch stub
// ---------------------------------------------------------------------------

interface StubOptions {
  trade?: TradeDetail
  saveError?: string
}

/**
 * Route a mocked fetch by path and method. Reference-data GETs always resolve;
 * the trade GET resolves only when a trade is provided; POST/PUT echo back a
 * trade (or fail with `saveError`).
 */
function stubApi({ trade, saveError }: StubOptions = {}) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'

    if (input.startsWith('/api/assets')) return jsonResponse(assets)
    if (input.startsWith('/api/tags')) return jsonResponse(tags)
    if (input.startsWith('/api/emotions/grouped')) return jsonResponse(emotionsGrouped)

    if ((method === 'POST' || method === 'PUT') && input.startsWith('/api/trades')) {
      if (saveError) {
        return jsonResponse(null, { ok: false, status: 400, error: saveError })
      }
      return jsonResponse(makeTrade({ id: 7 }))
    }

    if (method === 'GET' && input.startsWith('/api/trades/')) {
      return jsonResponse(trade ?? null)
    }

    throw new Error(`Unexpected fetch: ${method} ${input}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderNew() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/journal/new']}>
      <Routes>
        <Route path="/journal/new" element={<TradeFormPage />} />
        <Route path="/journal/:id" element={<div>Trade detail</div>} />
        <Route path="/journal" element={<div>Journal list</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEdit(tradeId = 1) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/journal/${tradeId}/edit`]}>
      <Routes>
        <Route path="/journal/:id/edit" element={<TradeFormPage />} />
        <Route path="/journal/:id" element={<div>Trade detail</div>} />
        <Route path="/journal" element={<div>Journal list</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Read the JSON body of the first POST/PUT call to /api/trades. */
function lastSaveBody(fetchMock: ReturnType<typeof stubApi>): TradeDetail & Record<string, unknown> {
  const call = fetchMock.mock.calls.find(
    ([input, init]: [string, RequestInit?]) =>
      ((init?.method ?? 'GET') === 'POST' || (init?.method ?? 'GET') === 'PUT') &&
      input.startsWith('/api/trades'),
  )
  if (!call) throw new Error('No save request was made')
  return JSON.parse(call[1]?.body as string)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TradeFormPage — create mode', () => {
  it('renders the form sections with one activity row', async () => {
    stubApi()
    renderNew()

    expect(await screen.findByText('New trade')).toBeInTheDocument()
    expect(screen.getByText('Activities')).toBeInTheDocument()
    expect(screen.getByText('Risk & timeframe')).toBeInTheDocument()
    // One activity row → exactly one Date / Price / Quantity field. Labels
    // carry a required asterisk, so match by substring.
    expect(screen.getAllByLabelText('Date', { exact: false })).toHaveLength(1)
    expect(screen.getByLabelText('Price', { exact: false })).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity', { exact: false })).toBeInTheDocument()
  })

  it('blocks submit and shows validation errors when required fields are empty', async () => {
    const fetchMock = stubApi()
    renderNew()

    await screen.findByText('New trade')
    fireEvent.click(screen.getByRole('button', { name: 'Create trade' }))

    expect(await screen.findByText('Asset is required')).toBeInTheDocument()
    expect(screen.getByText('Price must be greater than 0')).toBeInTheDocument()

    const saveCalls = fetchMock.mock.calls.filter(
      ([, init]: [string, RequestInit?]) => (init?.method ?? 'GET') === 'POST',
    )
    expect(saveCalls).toHaveLength(0)
  })

  it('adds and removes activity rows', async () => {
    stubApi()
    renderNew()

    await screen.findByText('New trade')
    expect(screen.getAllByLabelText('Date', { exact: false })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /add activity/i }))
    expect(screen.getAllByLabelText('Date', { exact: false })).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    expect(screen.getAllByLabelText('Date', { exact: false })).toHaveLength(1)
  })

  it('submits a create request and redirects to the new trade', async () => {
    const fetchMock = stubApi()
    renderNew()

    await screen.findByText('New trade')

    // Pick an active asset (the inactive "Retired pair" must not be offered).
    fireEvent.click(screen.getByPlaceholderText('Pick an asset'))
    expect(screen.queryByText('Retired pair')).not.toBeInTheDocument()
    fireEvent.click(await screen.findByText('EUR/USD'))

    fireEvent.change(screen.getByLabelText('Price', { exact: false }), {
      target: { value: '1.08' },
    })
    fireEvent.change(screen.getByLabelText('Quantity', { exact: false }), {
      target: { value: '1000' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create trade' }))

    await waitFor(() => {
      const body = lastSaveBody(fetchMock)
      expect(body.asset_id).toBe(1)
      expect(body.activities).toHaveLength(1)
      expect(body.activities[0].price).toBe(1.08)
      expect(body.activities[0].quantity).toBe(1000)
      expect(body.activities[0].type).toBe('Buy')
    })

    expect(await screen.findByText('Trade detail')).toBeInTheDocument()
  })

  it('shows a server error when the save fails', async () => {
    stubApi({ saveError: 'Asset 1 not found' })
    renderNew()

    await screen.findByText('New trade')

    fireEvent.click(screen.getByPlaceholderText('Pick an asset'))
    fireEvent.click(await screen.findByText('EUR/USD'))
    fireEvent.change(screen.getByLabelText('Price', { exact: false }), {
      target: { value: '1.08' },
    })
    fireEvent.change(screen.getByLabelText('Quantity', { exact: false }), {
      target: { value: '1000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create trade' }))

    expect(await screen.findByText('Asset 1 not found')).toBeInTheDocument()
  })
})

describe('TradeFormPage — edit mode', () => {
  it('prefills all fields from the existing trade', async () => {
    stubApi({ trade: makeTrade() })
    renderEdit()

    expect(await screen.findByText('Edit trade')).toBeInTheDocument()

    // Asset select shows the resolved name; notes and risk are prefilled.
    expect(await screen.findByDisplayValue('EUR/USD')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Followed the plan.')).toBeInTheDocument()
    expect(screen.getByLabelText('Risk per trade (%)')).toHaveValue('1.5%')

    // Two activities are prefilled from the trade.
    expect(screen.getAllByLabelText('Date', { exact: false })).toHaveLength(2)
  })

  it('submits a PUT with the prefilled values and redirects', async () => {
    const fetchMock = stubApi({ trade: makeTrade() })
    renderEdit()

    await screen.findByText('Edit trade')
    // Wait for prefill to settle (price field populated).
    await screen.findByDisplayValue('Followed the plan.')

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([input, init]: [string, RequestInit?]) =>
          (init?.method ?? 'GET') === 'PUT' && input === '/api/trades/1',
      )
      expect(call).toBeDefined()
      const body = JSON.parse(call![1]?.body as string)
      expect(body.asset_id).toBe(1)
      expect(body.notes).toBe('Followed the plan.')
      expect(body.timeframe_unit).toBe('m')
      expect(body.timeframe_value).toBe(15)
      expect(body.tag_ids).toEqual([10])
      expect(body.emotion_ids).toEqual([20])
      expect(body.activities).toHaveLength(2)
    })

    expect(await screen.findByText('Trade detail')).toBeInTheDocument()
  })

  it('shows a not-found alert when the trade does not exist', async () => {
    const notFoundFetch = vi.fn(async (input: string) => {
      if (input.startsWith('/api/assets')) return jsonResponse(assets)
      if (input.startsWith('/api/tags')) return jsonResponse(tags)
      if (input.startsWith('/api/emotions/grouped')) return jsonResponse(emotionsGrouped)
      if (input.startsWith('/api/trades/')) {
        return jsonResponse(null, { ok: false, status: 404, error: 'Trade 99 not found' })
      }
      throw new Error(`Unexpected fetch: ${input}`)
    })
    vi.stubGlobal('fetch', notFoundFetch)

    renderEdit(99)

    expect(await screen.findByText('Trade not found')).toBeInTheDocument()
  })
})
