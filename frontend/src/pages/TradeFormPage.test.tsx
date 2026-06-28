import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TradeFormPage } from '@/pages/TradeFormPage'
import { EMOTION_PRESETS } from '@/data/emotionPresets'
import type { Asset, Emotion, Tag } from '@/types/referenceData'
import type { ChartTimeframe, TradeDetail } from '@/types/trade'
import { jsonResponse, renderWithProviders } from '@/test/utils'
import { assertDefined } from '@/test/helpers'

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
    tags: tags.slice(0, 1),
    emotions: (emotionsGrouped['Emotional State'] ?? []).slice(0, 1),
    screenshots: [],
    chart_timeframes: null,
    resolved_chart_timeframes: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Fetch stub
// ---------------------------------------------------------------------------

interface StubOptions {
  trade?: TradeDetail
  saveError?: string
  defaultRisk?: number
  chartTimeframesDefault?: ChartTimeframe[]
  entryTimeframeUnitDefault?: string | null
  entryTimeframeValueDefault?: number | null
  chartTimeframesWarningThreshold?: number
}

/**
 * Route a mocked fetch by path and method. Reference-data GETs always resolve;
 * the trade GET resolves only when a trade is provided; POST/PUT echo back a
 * trade (or fail with `saveError`); screenshot POSTs echo a screenshot record.
 * The preferences GET returns the stored default risk; its PATCH echoes back
 * the patched value.
 */
function stubApi({
  trade,
  saveError,
  defaultRisk = 1,
  chartTimeframesDefault = [],
  entryTimeframeUnitDefault = null,
  entryTimeframeValueDefault = null,
  chartTimeframesWarningThreshold = 8,
}: StubOptions = {}) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'

    if (input.startsWith('/api/assets')) return jsonResponse(assets)
    if (input.startsWith('/api/tags')) return jsonResponse(tags)
    if (input.startsWith('/api/emotions/grouped')) return jsonResponse(emotionsGrouped)
    if (input.startsWith('/api/preferences')) {
      if (method === 'PATCH') {
        return jsonResponse(JSON.parse(init?.body as string))
      }
      return jsonResponse({
          risk_per_trade_default: defaultRisk,
          chart_timeframes_default: chartTimeframesDefault,
          entry_timeframe_unit_default: entryTimeframeUnitDefault,
          entry_timeframe_value_default: entryTimeframeValueDefault,
          chart_timeframes_warning_threshold: chartTimeframesWarningThreshold,
        })
    }

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
  fireEvent.click(screen.getByText('EUR/USD (USD)'))
  fireEvent.click(screen.getByText('Long'))
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1000' } })
  fireEvent.change(screen.getByLabelText('Price'), { target: { value: '1.08' } })
  fireEvent.change(screen.getByLabelText('Stop loss', { exact: false }), {
    target: { value: '1.07' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' })
    const firstRemoveBtn = removeButtons[0]
    assertDefined(firstRemoveBtn)
    fireEvent.click(firstRemoveBtn)
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
      const firstActivity = body.activities[0]
      assertDefined(firstActivity)
      expect(firstActivity.price).toBe(1.08)
      expect(firstActivity.quantity).toBe(1000)
      expect(firstActivity.type).toBe('Buy')
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
    const exitQtyInput = quantities[1]
    assertDefined(exitQtyInput)
    fireEvent.change(exitQtyInput, { target: { value: '5000' } })

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

    expect(await screen.findByDisplayValue('EUR/USD (USD)')).toBeInTheDocument()
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

  it('keeps the trade own risk value, not the stored default (#62)', async () => {
    // The trade carries risk_per_trade 1.5; the stored default is 2.
    stubApi({ trade: makeTrade({ risk_per_trade: 1.5 }), defaultRisk: 2 })
    renderEdit()

    await screen.findByText('Edit trade')
    // The prefilled value survives — it is not overridden by the default.
    expect(await screen.findByDisplayValue('1.5%')).toBeInTheDocument()
  })

  it('shows a not-found alert when the trade does not exist', async () => {
    const notFoundFetch = vi.fn(async (input: string) => {
      if (input.startsWith('/api/assets')) return jsonResponse(assets)
      if (input.startsWith('/api/tags')) return jsonResponse(tags)
      if (input.startsWith('/api/emotions/grouped')) return jsonResponse(emotionsGrouped)
      if (input.startsWith('/api/preferences')) {
        return jsonResponse({ risk_per_trade_default: 1 })
      }
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

// ---------------------------------------------------------------------------
// Inline reference-data creation (#55)
// ---------------------------------------------------------------------------

/**
 * Stateful fetch stub: POSTs to /assets, /tags, /emotions append to the
 * in-memory lists and echo the created record, so a subsequent reload reflects
 * the new entity (mirrors how inline creation refreshes the selectors). An
 * optional `trade` is returned for the trade GET to drive edit-mode prefill.
 */
function stubStatefulApi(trade: TradeDetail | null = null) {
  const assetList = [...assets]
  const tagList = [...tags]
  const emotionMap: Record<string, Emotion[]> = {
    'Emotional State': [...(emotionsGrouped['Emotional State'] ?? [])],
  }
  let nextId = 100

  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body as string) : null

    if (input.startsWith('/api/assets')) {
      if (method === 'POST') {
        const created: Asset = {
          id: nextId++,
          name: body.name,
          category: body.category,
          currency: body.currency,
          is_active: true,
          created_at: null,
          updated_at: null,
        }
        assetList.push(created)
        return jsonResponse(created)
      }
      // Return a fresh copy so each reload yields a new reference (the real API
      // serializes JSON; reusing the mutated array would defeat React's diff).
      return jsonResponse([...assetList])
    }
    if (input.startsWith('/api/tags')) {
      if (method === 'POST') {
        const created: Tag = {
          id: nextId++,
          name: body.name,
          description: body.description,
          is_active: true,
          created_at: null,
          updated_at: null,
        }
        tagList.push(created)
        return jsonResponse(created)
      }
      return jsonResponse([...tagList])
    }
    if (input.startsWith('/api/emotions/grouped')) {
      return jsonResponse(
        Object.fromEntries(Object.entries(emotionMap).map(([key, list]) => [key, [...list]])),
      )
    }
    if (input.startsWith('/api/emotions')) {
      if (method === 'POST') {
        const created: Emotion = {
          id: nextId++,
          name: body.name,
          description: body.description,
          severity: body.severity,
          category: body.category,
          created_at: null,
          updated_at: null,
        }
        ;(emotionMap[body.category] ??= []).push(created)
        return jsonResponse(created)
      }
      return jsonResponse(emotionMap)
    }
    if (input.startsWith('/api/preferences')) {
      return jsonResponse({ risk_per_trade_default: 1 })
    }
    if (method === 'GET' && input.startsWith('/api/trades/')) return jsonResponse(trade)

    throw new Error(`Unexpected fetch: ${method} ${input}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// ---------------------------------------------------------------------------
// Default risk per trade — prefill & "Save as default" (#62)
// ---------------------------------------------------------------------------

describe('TradeFormPage — default risk per trade (#62)', () => {
  it('prefills the risk field from the stored default on create', async () => {
    stubApi({ defaultRisk: 2 })
    renderNew()

    await screen.findByText('New trade')
    // The field is populated with the stored default (2%).
    expect(await screen.findByDisplayValue('2%')).toBeInTheDocument()
    // Matching the default shows the "Default" label, not the save link.
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.queryByText('Save as default')).not.toBeInTheDocument()
  })

  it('saves a new default via PATCH and confirms with "Saved!"', async () => {
    const fetchMock = stubApi({ defaultRisk: 1 })
    renderNew()

    await screen.findByText('New trade')
    // Wait for the prefill (1%) so the comparison baseline is in place.
    await screen.findByDisplayValue('1%')

    const riskInput = screen.getByLabelText('Risk per trade (%)')
    fireEvent.change(riskInput, { target: { value: '2' } })

    // The value now differs from the stored default → the link appears.
    const link = await screen.findByText('Save as default')
    fireEvent.click(link)

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([input, init]: [string, RequestInit?]) =>
          (init?.method ?? 'GET') === 'PATCH' && input.startsWith('/api/preferences'),
      )
      expect(call).toBeDefined()
      expect(JSON.parse(call![1]?.body as string)).toEqual({ risk_per_trade_default: 2 })
    })

    // Confirmation is shown; the link is gone now the value matches the default.
    expect(await screen.findByText('Saved!')).toBeInTheDocument()
    expect(screen.queryByText('Save as default')).not.toBeInTheDocument()
  })

  it('does not save when the risk value is invalid', async () => {
    const fetchMock = stubApi({ defaultRisk: 1 })
    renderNew()

    await screen.findByText('New trade')
    await screen.findByDisplayValue('1%')

    const riskInput = screen.getByLabelText('Risk per trade (%)')
    fireEvent.change(riskInput, { target: { value: '0' } })

    // Zero is out of range → no link, so no PATCH can be triggered.
    expect(screen.queryByText('Save as default')).not.toBeInTheDocument()
    const patchCalls = fetchMock.mock.calls.filter(
      ([input, init]: [string, RequestInit?]) =>
        (init?.method ?? 'GET') === 'PATCH' && input.startsWith('/api/preferences'),
    )
    expect(patchCalls).toHaveLength(0)
  })
})

describe('TradeFormPage — inline reference-data creation', () => {
  it('creates an asset inline and auto-selects it', async () => {
    stubStatefulApi()
    renderNew()
    await screen.findByText('New trade')

    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
    const dialog = within(await screen.findByRole('dialog'))

    fireEvent.change(dialog.getByLabelText('Name', { exact: false }), { target: { value: 'GBP/USD' } })
    fireEvent.click(dialog.getByPlaceholderText('Pick a category'))
    fireEvent.click(await screen.findByRole('option', { name: 'Forex' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }))

    // The new asset is loaded into the selector and selected as the value.
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Pick an asset')).toHaveValue('GBP/USD'),
    )
  })

  it('creates a tag inline and adds it to the selection', async () => {
    stubStatefulApi()
    renderNew()
    await screen.findByText('New trade')

    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    const dialog = within(await screen.findByRole('dialog'))

    fireEvent.change(dialog.getByLabelText('Name', { exact: false }), { target: { value: 'Pullback' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }))

    // The modal closes and the new tag is selected as a pill in the multi-select
    // (distinct from the now-mounted dropdown option of the same name).
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const tagPill = (await screen.findAllByText('Pullback')).find(
      (el) => !el.closest('[role="option"]'),
    )
    expect(tagPill).toBeDefined()
  })

  it('creates an emotion inline and adds it to the selection', async () => {
    stubStatefulApi()
    renderNew()
    await screen.findByText('New trade')

    fireEvent.click(screen.getByRole('button', { name: 'Add emotion' }))
    const dialog = within(await screen.findByRole('dialog'))

    fireEvent.change(dialog.getByLabelText('Name', { exact: false }), { target: { value: 'Revenge' } })
    fireEvent.click(dialog.getByPlaceholderText('Pick a category'))
    fireEvent.click(await screen.findByRole('option', { name: 'Mental Triggers' }))
    fireEvent.click(dialog.getByPlaceholderText('Pick a severity'))
    fireEvent.click(await screen.findByRole('option', { name: 'Bad' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const emotionPill = (await screen.findAllByText('Revenge')).find(
      (el) => !el.closest('[role="option"]'),
    )
    expect(emotionPill).toBeDefined()
  })

  it('dismissing the asset modal makes no change and sends no request', async () => {
    const fetchMock = stubStatefulApi()
    renderNew()
    await screen.findByText('New trade')

    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
    await screen.findByRole('heading', { name: 'Add asset' })

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Add asset' })).not.toBeInTheDocument()
    })
    const assetPosts = fetchMock.mock.calls.filter(
      ([input, init]: [string, RequestInit?]) =>
        (init?.method ?? 'GET') === 'POST' && input.startsWith('/api/assets'),
    )
    expect(assetPosts).toHaveLength(0)
  })

  it('exposes the add buttons in edit mode as well', async () => {
    stubStatefulApi()
    renderEdit()
    await screen.findByText('Edit trade')

    expect(screen.getByRole('button', { name: 'Add asset' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add tag' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add emotion' })).toBeInTheDocument()
  })

  it('adds an inline tag in edit mode without dropping the prefilled selection', async () => {
    // The edit stub prefills tag_ids with the existing trade's "Breakout" tag.
    stubStatefulApi(makeTrade())
    renderEdit()
    await screen.findByText('Edit trade')

    // Helper: the selected pill for `name` is the text node not inside an option.
    const selectedPill = (name: string) =>
      screen.queryAllByText(name).find((el) => !el.closest('[role="option"]'))

    // The prefilled tag is already selected as a pill.
    await waitFor(() => expect(selectedPill('Breakout')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Name', { exact: false }), { target: { value: 'Pullback' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // The new tag is added AND the previously selected tag survives the spread.
    await waitFor(() => expect(selectedPill('Pullback')).toBeDefined())
    expect(selectedPill('Breakout')).toBeDefined()
  })
})

describe('TradeFormPage — emotions nudge (no emotions)', () => {
  /**
   * Like `stubApi`, but the grouped-emotions GET starts empty and flips to a
   * single emotion once the bulk-import POST has been issued, so the nudge can
   * be observed appearing and then disappearing after import.
   */
  function stubApiNoEmotions({ importError = false }: { importError?: boolean } = {}) {
    let imported = false
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'

      if (input.startsWith('/api/assets')) return jsonResponse(assets)
      if (input.startsWith('/api/tags')) return jsonResponse(tags)
      if (input.startsWith('/api/emotions/bulk') && method === 'POST') {
        if (importError) {
          return jsonResponse(null, { ok: false, status: 500, error: 'boom' })
        }
        imported = true
        return jsonResponse(emotionsGrouped['Emotional State'])
      }
      if (input.startsWith('/api/emotions/grouped')) {
        return jsonResponse(imported ? emotionsGrouped : {})
      }
      if (input.startsWith('/api/preferences')) {
        return jsonResponse({ risk_per_trade_default: 1 })
      }
      throw new Error(`Unexpected fetch: ${method} ${input}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('shows the nudge Alert when no emotions exist', async () => {
    stubApiNoEmotions()
    renderNew()

    expect(
      await screen.findByText(
        /No emotions configured yet\. Import our starter set/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Import starter set' }),
    ).toBeInTheDocument()
  })

  it('imports the starter set in the current language and hides the nudge', async () => {
    const fetchMock = stubApiNoEmotions()
    const showSpy = vi.spyOn(notifications, 'show')
    renderNew()

    fireEvent.click(await screen.findByRole('button', { name: 'Import starter set' }))

    // Assert: the bulk endpoint received all 42 presets (current language = en).
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/emotions/bulk',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    const bulkCall = fetchMock.mock.calls.find(([url]) =>
      url.startsWith('/api/emotions/bulk'),
    )
    const body = JSON.parse((bulkCall?.[1] as RequestInit).body as string)
    expect(body.emotions).toHaveLength(EMOTION_PRESETS.en.length)

    // Assert: once emotions exist, the nudge disappears.
    await waitFor(() =>
      expect(
        screen.queryByText(/No emotions configured yet/i),
      ).not.toBeInTheDocument(),
    )
    expect(showSpy).toHaveBeenCalled()
  })

  it('shows an error notification when the import fails', async () => {
    stubApiNoEmotions({ importError: true })
    const showSpy = vi.spyOn(notifications, 'show')
    renderNew()

    fireEvent.click(await screen.findByRole('button', { name: 'Import starter set' }))

    await waitFor(() =>
      expect(showSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to import emotions' }),
      ),
    )
    // The nudge remains after a failed import.
    expect(
      screen.getByText(/No emotions configured yet/i),
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Chart timeframes (#238)
// ---------------------------------------------------------------------------

describe('TradeFormPage — chart timeframes (#238)', () => {
  it('prefills chart timeframes from stored defaults on create', async () => {
    stubApi({
      chartTimeframesDefault: [
        { unit: 'm', value: 15 },
        { unit: 'h', value: 1 },
      ],
    })
    renderNew()

    await screen.findByText('New trade')
    expect(await screen.findByText('15m')).toBeInTheDocument()
    expect(screen.getByText('1h')).toBeInTheDocument()
  })

  it('adds a new removable chip when a value + Add are used', async () => {
    stubApi()
    renderNew()

    await screen.findByText('New trade')
    fireEvent.change(screen.getByLabelText('Add a timeframe'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('5m')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove 5m' })).toBeInTheDocument()
  })

  it('removes a chip when its remove button is clicked', async () => {
    stubApi({
      chartTimeframesDefault: [
        { unit: 'm', value: 15 },
        { unit: 'h', value: 1 },
      ],
    })
    renderNew()

    await screen.findByText('15m')
    fireEvent.click(screen.getByRole('button', { name: 'Remove 15m' }))

    await waitFor(() => {
      expect(screen.queryByText('15m')).not.toBeInTheDocument()
    })
    expect(screen.getByText('1h')).toBeInTheDocument()
  })

  it('does not add a duplicate chip for an already-listed timeframe', async () => {
    stubApi({
      chartTimeframesDefault: [{ unit: 'm', value: 15 }],
    })
    renderNew()

    await screen.findByText('15m')
    // Attempt to add 15m a second time.
    fireEvent.change(screen.getByLabelText('Add a timeframe'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    // Exactly one remove button means the chip exists only once.
    expect(screen.getAllByRole('button', { name: 'Remove 15m' })).toHaveLength(1)
  })

  it('sends chart_timeframes: null when the list is unchanged from defaults', async () => {
    const fetchMock = stubApi({
      chartTimeframesDefault: [{ unit: 'm', value: 15 }],
    })
    renderNew()

    await screen.findByText('New trade')
    await screen.findByText('15m')
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: 'Create trade' }))

    await waitFor(() => {
      const body = lastSaveBody(fetchMock)
      expect(body.chart_timeframes).toBeNull()
    })
  })

  it('sends explicit chart_timeframes when the list differs from defaults', async () => {
    const fetchMock = stubApi({
      chartTimeframesDefault: [
        { unit: 'm', value: 15 },
        { unit: 'h', value: 1 },
      ],
    })
    renderNew()

    await screen.findByText('1h')
    // Remove 1h so the list no longer matches defaults.
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1h' }))
    await waitFor(() => expect(screen.queryByText('1h')).not.toBeInTheDocument())

    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: 'Create trade' }))

    await waitFor(() => {
      const body = lastSaveBody(fetchMock)
      expect(body.chart_timeframes).toEqual([{ unit: 'm', value: 15 }])
    })
  })

  it('renders the entry chip as locked with no remove button when entry tf matches a chart tf', async () => {
    stubApi({
      entryTimeframeUnitDefault: 'm',
      entryTimeframeValueDefault: 15,
      chartTimeframesDefault: [
        { unit: 'm', value: 15 },
        { unit: 'h', value: 1 },
      ],
    })
    renderNew()

    await screen.findByText('New trade')
    // The locked chip shows the "entry · always" note.
    expect(await screen.findByText('entry · always')).toBeInTheDocument()
    // The locked 15m chip has no remove button.
    expect(screen.queryByRole('button', { name: 'Remove 15m' })).not.toBeInTheDocument()
    // The other chip remains removable.
    expect(screen.getByRole('button', { name: 'Remove 1h' })).toBeInTheDocument()
  })

  it('shows the warning alert when displayed timeframe count exceeds the threshold', async () => {
    stubApi({
      chartTimeframesDefault: [
        { unit: 'm', value: 5 },
        { unit: 'm', value: 15 },
        { unit: 'h', value: 1 },
      ],
      chartTimeframesWarningThreshold: 2,
    })
    renderNew()

    await screen.findByText('New trade')
    // 3 chips > threshold 2 → warning should appear.
    expect(
      await screen.findByText(/Chart loading may be slower with more than/i),
    ).toBeInTheDocument()
  })

  it('does not show the warning alert when at or below the threshold', async () => {
    stubApi({
      chartTimeframesDefault: [
        { unit: 'm', value: 5 },
        { unit: 'm', value: 15 },
      ],
      chartTimeframesWarningThreshold: 2,
    })
    renderNew()

    await screen.findByText('5m')
    // 2 chips === threshold 2 → strictly greater-than, so no warning.
    expect(
      screen.queryByText(/Chart loading may be slower with more than/i),
    ).not.toBeInTheDocument()
  })

  it('uses the trade chart_timeframes in edit mode when they are non-null', async () => {
    // Clear the entry timeframe so the locked chip does not interfere with
    // the assertion that the preferences default (15m) is absent.
    const trade = makeTrade({
      chart_timeframes: [{ unit: 'h', value: 4 }],
      timeframe_unit: null,
      timeframe_value: null,
    })
    stubApi({
      trade,
      chartTimeframesDefault: [{ unit: 'm', value: 15 }],
    })
    renderEdit()

    await screen.findByText('Edit trade')
    // The trade's own chart_timeframes are shown.
    expect(await screen.findByText('4h')).toBeInTheDocument()
    // The preferences default 15m is not shown (trade override takes precedence).
    expect(screen.queryByRole('button', { name: 'Remove 15m' })).not.toBeInTheDocument()
  })

  it('falls back to the default chart_timeframes in edit mode when trade has null', async () => {
    const trade = makeTrade({ chart_timeframes: null })
    stubApi({
      trade,
      chartTimeframesDefault: [{ unit: 'm', value: 15 }],
    })
    renderEdit()

    await screen.findByText('Edit trade')
    expect(await screen.findByText('15m')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Entry timeframe default (#238)
// ---------------------------------------------------------------------------

describe('TradeFormPage — entry timeframe default (#238)', () => {
  it('prefills the entry timeframe fields from the stored default on create', async () => {
    stubApi({
      entryTimeframeUnitDefault: 'h',
      entryTimeframeValueDefault: 4,
    })
    renderNew()

    await screen.findByText('New trade')
    // Unit select shows the option label for 'h'.
    expect(await screen.findByDisplayValue('Hours')).toBeInTheDocument()
    // Value input shows the numeric default.
    expect(screen.getByLabelText('Timeframe value')).toHaveValue('4')
  })

  it('shows "Save as default" when entry tf differs from saved default and saves on click', async () => {
    const fetchMock = stubApi({
      entryTimeframeUnitDefault: 'm',
      entryTimeframeValueDefault: 15,
    })
    renderNew()

    await screen.findByText('New trade')
    // Risk also matches its default (1), so it shows "Default"; entry TF also shows "Default".
    // Wait for both to settle — findAllByText handles the initial multiple matches.
    await waitFor(() =>
      expect(screen.getAllByText('Default').length).toBeGreaterThanOrEqual(1),
    )

    // Change the entry TF value to 5 — now differs from saved default 15m.
    fireEvent.change(screen.getByLabelText('Timeframe value'), { target: { value: '5' } })

    // The entry TF "Save as default" link appears (risk still shows "Default").
    const link = await screen.findByText('Save as default')
    fireEvent.click(link)

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([input, init]: [string, RequestInit?]) =>
          (init?.method ?? 'GET') === 'PATCH' && input.startsWith('/api/preferences'),
      )
      expect(call).toBeDefined()
      expect(JSON.parse(call![1]?.body as string)).toMatchObject({
        entry_timeframe_unit_default: 'm',
        entry_timeframe_value_default: 5,
      })
    })

    // Confirmation is shown; the "Save as default" link disappears.
    expect(await screen.findByText('Saved!')).toBeInTheDocument()
    expect(screen.queryByText('Save as default')).not.toBeInTheDocument()
  })
})
