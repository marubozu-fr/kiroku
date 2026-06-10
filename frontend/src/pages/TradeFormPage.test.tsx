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
    account_type: 'live',
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
 * trade (or fail with `saveError`); screenshot POSTs echo a screenshot record.
 */
function stubApi({ trade, saveError }: StubOptions = {}) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'

    if (input.startsWith('/api/assets')) return jsonResponse(assets)
    if (input.startsWith('/api/tags')) return jsonResponse(tags)
    if (input.startsWith('/api/emotions/grouped')) return jsonResponse(emotionsGrouped)

    if (method === 'POST' && input.includes('/screenshots')) {
      return jsonResponse({ id: 99 })
    }
    if (method === 'DELETE' && input.startsWith('/api/screenshots/')) {
      return jsonResponse({ id: 99 })
    }

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

/** Read the JSON body of the first POST/PUT to /api/trades (not /screenshots). */
function lastSaveBody(fetchMock: ReturnType<typeof stubApi>): TradeDetail & Record<string, unknown> {
  const call = fetchMock.mock.calls.find(
    ([input, init]: [string, RequestInit?]) =>
      ((init?.method ?? 'GET') === 'POST' || (init?.method ?? 'GET') === 'PUT') &&
      input.startsWith('/api/trades') &&
      !input.includes('/screenshots'),
  )
  if (!call) throw new Error('No save request was made')
  return JSON.parse(call[1]?.body as string)
}

/** Fill the minimum required fields for a valid create: direction, entry, stop loss. */
function fillRequired() {
  fireEvent.click(screen.getByPlaceholderText('Pick an asset'))
  fireEvent.click(screen.getByText('EUR/USD'))
  fireEvent.click(screen.getByText('Long'))
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1000' } })
  fireEvent.change(screen.getByLabelText('Price'), { target: { value: '1.08' } })
  fireEvent.change(screen.getByLabelText('Stop loss', { exact: false }), {
    target: { value: '1.07' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TradeFormPage — create mode', () => {
  it('renders configuration and activities with one entry and no exits', async () => {
    stubApi()
    renderNew()

    expect(await screen.findByText('New trade')).toBeInTheDocument()
    expect(screen.getByText('Configuration')).toBeInTheDocument()
    expect(screen.getByText('Activities')).toBeInTheDocument()
    // One entry row → exactly one Quantity / Price field; no exit rows yet.
    expect(screen.getByLabelText('Entry date')).toBeInTheDocument()
    expect(screen.queryByLabelText('Exit date')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('Quantity')).toHaveLength(1)
  })

  it('blocks submit and shows validation errors when required fields are empty', async () => {
    const fetchMock = stubApi()
    renderNew()

    await screen.findByText('New trade')
    fireEvent.click(screen.getByRole('button', { name: 'Create trade' }))

    expect(await screen.findByText('Asset is required')).toBeInTheDocument()
    expect(screen.getByText('Direction is required')).toBeInTheDocument()
    expect(screen.getByText('Price must be greater than 0')).toBeInTheDocument()

    const saveCalls = fetchMock.mock.calls.filter(
      ([, init]: [string, RequestInit?]) => (init?.method ?? 'GET') === 'POST',
    )
    expect(saveCalls).toHaveLength(0)
  })

  it('unlocks the exits section once an entry quantity is set', async () => {
    stubApi()
    renderNew()

    await screen.findByText('New trade')
    const addExit = screen.getByRole('button', { name: /add exit/i })
    expect(addExit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1000' } })
    expect(screen.getByRole('button', { name: /add exit/i })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /add exit/i }))
    expect(screen.getByLabelText('Exit date')).toBeInTheDocument()
  })

  it('adds and removes entry rows', async () => {
    stubApi()
    renderNew()

    await screen.findByText('New trade')
    expect(screen.getAllByLabelText('Quantity')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /add entry/i }))
    expect(screen.getAllByLabelText('Quantity')).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(screen.getAllByLabelText('Quantity')).toHaveLength(1)
  })

  it('submits a create request with direction-typed activities and account type', async () => {
    const fetchMock = stubApi()
    renderNew()

    await screen.findByText('New trade')

    // The inactive "Retired pair" must not be offered.
    fireEvent.click(screen.getByPlaceholderText('Pick an asset'))
    expect(screen.queryByText('Retired pair')).not.toBeInTheDocument()
    fillRequired()

    fireEvent.click(screen.getByRole('button', { name: 'Create trade' }))

    await waitFor(() => {
      const body = lastSaveBody(fetchMock)
      expect(body.asset_id).toBe(1)
      expect(body.account_type).toBe('live')
      expect(body.activities).toHaveLength(1)
      expect(body.activities[0].price).toBe(1.08)
      expect(body.activities[0].quantity).toBe(1000)
      expect(body.activities[0].type).toBe('Buy')
    })

    expect(await screen.findByText('Trade detail')).toBeInTheDocument()
  })

  it('blocks submit when exit quantity exceeds entry quantity', async () => {
    const fetchMock = stubApi()
    renderNew()

    await screen.findByText('New trade')
    fillRequired()

    fireEvent.click(screen.getByRole('button', { name: /add exit/i }))
    const quantities = screen.getAllByLabelText('Quantity')
    fireEvent.change(quantities[1], { target: { value: '5000' } })

    expect(
      await screen.findByText('Exit quantity cannot exceed entry quantity'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create trade' }))
    await waitFor(() => {
      const saveCalls = fetchMock.mock.calls.filter(
        ([input, init]: [string, RequestInit?]) =>
          (init?.method ?? 'GET') === 'POST' && !input.includes('/screenshots'),
      )
      expect(saveCalls).toHaveLength(0)
    })
  })

  it('shows a server error when the save fails', async () => {
    stubApi({ saveError: 'Asset 1 not found' })
    renderNew()

    await screen.findByText('New trade')
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: 'Create trade' }))

    expect(await screen.findByText('Asset 1 not found')).toBeInTheDocument()
  })
})

describe('TradeFormPage — edit mode', () => {
  it('prefills all fields from the existing trade, splitting entries and exits', async () => {
    stubApi({ trade: makeTrade() })
    renderEdit()

    expect(await screen.findByText('Edit trade')).toBeInTheDocument()

    expect(await screen.findByDisplayValue('EUR/USD')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Followed the plan.')).toBeInTheDocument()
    expect(screen.getByLabelText('Risk per trade (%)')).toHaveValue('1.5%')

    // One Buy entry and one Sell exit are split into the two sub-sections.
    expect(screen.getByLabelText('Entry date')).toBeInTheDocument()
    expect(screen.getByLabelText('Exit date')).toBeInTheDocument()
  })

  it('submits a PUT with the prefilled values and redirects', async () => {
    const fetchMock = stubApi({ trade: makeTrade() })
    renderEdit()

    await screen.findByText('Edit trade')
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
      expect(body.account_type).toBe('live')
      expect(body.notes).toBe('Followed the plan.')
      expect(body.timeframe_unit).toBe('m')
      expect(body.timeframe_value).toBe(15)
      expect(body.tag_ids).toEqual([10])
      expect(body.emotion_ids).toEqual([20])
      // One Buy entry + one Sell exit, recombined into activities.
      expect(body.activities).toHaveLength(2)
      expect(body.activities[0].type).toBe('Buy')
      expect(body.activities[1].type).toBe('Sell')
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
