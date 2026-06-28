import { StrictMode } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMantineColorScheme } from '@mantine/core'
import type { TradeCandlesResponse } from '@/types/candle'
import type { ResolvedTimeframe } from '@/types/trade'
import { renderWithProviders } from '@/test/utils'

// ---------------------------------------------------------------------------
// Hoisted mock state — vi.mock factories are hoisted before imports, so we
// use vi.hoisted() to define the spy references that the factory closes over.
// ---------------------------------------------------------------------------

const {
  mockCreateChart,
  mockAddCandlestickSeries,
  mockSetData,
  mockSetMarkers,
  mockCreatePriceLine,
  mockSeriesApplyOptions,
  mockFitContent,
  mockApplyOptions,
  mockRemove,
  mockCandles,
} = vi.hoisted(() => {
  const mockSetData = vi.fn()
  const mockSetMarkers = vi.fn()
  const mockCreatePriceLine = vi.fn()
  const mockSeriesApplyOptions = vi.fn()
  const mockFitContent = vi.fn()
  const mockApplyOptions = vi.fn()
  const mockRemove = vi.fn()

  const mockAddCandlestickSeries = vi.fn(() => ({
    setData: mockSetData,
    setMarkers: mockSetMarkers,
    createPriceLine: mockCreatePriceLine,
    applyOptions: mockSeriesApplyOptions,
  }))

  const mockCreateChart = vi.fn(() => ({
    addCandlestickSeries: mockAddCandlestickSeries,
    timeScale: () => ({ fitContent: mockFitContent }),
    applyOptions: mockApplyOptions,
    remove: mockRemove,
  }))

  const mockCandles = vi.fn<
    (
      id: number,
      resolution?: string,
      signal?: AbortSignal,
    ) => Promise<TradeCandlesResponse>
  >()

  return {
    mockCreateChart,
    mockAddCandlestickSeries,
    mockSetData,
    mockSetMarkers,
    mockCreatePriceLine,
    mockSeriesApplyOptions,
    mockFitContent,
    mockApplyOptions,
    mockRemove,
    mockCandles,
  }
})

// ---------------------------------------------------------------------------
// Mock lightweight-charts — jsdom has no canvas, so the real library crashes.
// ---------------------------------------------------------------------------

vi.mock('lightweight-charts', () => ({
  createChart: mockCreateChart,
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dashed: 1 },
}))

// ---------------------------------------------------------------------------
// Mock tradesApi — we control candles() resolution per test.
// ---------------------------------------------------------------------------

vi.mock('@/services/trades', () => ({
  tradesApi: {
    candles: (...args: [number, string | undefined, AbortSignal | undefined]) =>
      mockCandles(...args),
  },
}))

// ---------------------------------------------------------------------------
// Import the component AFTER the mocks are declared.
// ---------------------------------------------------------------------------

import { TradeChart } from '@/components/trades/TradeChart'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Backend-sorted resolved timeframes (weight descending). M15 is the entry.
const RESOLVED_TFS: ResolvedTimeframe[] = [
  { unit: 'h', value: 1, resolution: 'H1', is_entry: false },
  { unit: 'm', value: 15, resolution: 'M15', is_entry: true },
  { unit: 'm', value: 5, resolution: 'M5', is_entry: false },
]

const NO_TICKER_RESPONSE: TradeCandlesResponse = {
  data: null,
  meta: { reason: 'no_ticker' },
  error: null,
}

const NO_DATA_RESPONSE: TradeCandlesResponse = {
  data: {
    ticker: 'C:EURUSD',
    resolution: 'M15',
    candles: [],
    markers: [],
    levels: { stop_loss: null, take_profits: [] },
    window: { start: '2026-01-01', end: '2026-01-08' },
  },
  meta: { reason: 'pending' },
  error: null,
}

// Two OHLC bars with realistic EURUSD prices; timestamps in milliseconds.
const SUCCESS_RESPONSE: TradeCandlesResponse = {
  data: {
    ticker: 'C:EURUSD',
    resolution: 'M15',
    candles: [
      {
        timestamp: 1_735_689_600_000,
        open: 1.08250,
        high: 1.08420,
        low: 1.08190,
        close: 1.08380,
        volume: 5000,
      },
      {
        timestamp: 1_735_690_500_000,
        open: 1.08380,
        high: 1.08500,
        low: 1.08310,
        close: 1.08450,
        volume: 4200,
      },
    ],
    markers: [
      {
        timestamp: 1_735_689_600_000,
        type: 'entry',
        side: 'Buy',
        price: 1.08250,
        quantity: 10000,
      },
      {
        timestamp: 1_735_690_500_000,
        type: 'exit',
        side: 'Sell',
        price: 1.08450,
        quantity: 10000,
      },
    ],
    levels: { stop_loss: 1.08000, take_profits: [1.08600] },
    window: { start: '2026-01-01', end: '2026-01-08' },
  },
  meta: null,
  error: null,
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Restore the default chart instance shape after clearAllMocks resets the impl.
  mockAddCandlestickSeries.mockReturnValue({
    setData: mockSetData,
    setMarkers: mockSetMarkers,
    createPriceLine: mockCreatePriceLine,
    applyOptions: mockSeriesApplyOptions,
  })
  mockCreateChart.mockReturnValue({
    addCandlestickSeries: mockAddCandlestickSeries,
    timeScale: () => ({ fitContent: mockFitContent }),
    applyOptions: mockApplyOptions,
    remove: mockRemove,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TradeChart', () => {
  it('renders a Skeleton and the timeframe buttons while data is loading', async () => {
    // Never resolves during the test
    mockCandles.mockReturnValue(new Promise<TradeCandlesResponse>(() => undefined))

    renderWithProviders(
      <TradeChart tradeId={1} resolvedTimeframes={RESOLVED_TFS} />,
    )

    // Mantine Skeleton renders as a div with the mantine-Skeleton-root class
    await waitFor(() => {
      const skeleton = document.querySelector('.mantine-Skeleton-root')
      expect(skeleton).not.toBeNull()
    })

    // All timeframe buttons are visible
    expect(screen.getByRole('button', { name: 'M15' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'H1' })).toBeInTheDocument()
  })

  it('renders the no_ticker placeholder when the asset has no linked ticker', async () => {
    mockCandles.mockResolvedValue(NO_TICKER_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={2} resolvedTimeframes={RESOLVED_TFS} />,
    )

    expect(
      await screen.findByText(
        'Link this asset to a market data ticker in Settings to display charts',
      ),
    ).toBeInTheDocument()

    // The timeframe buttons are present in every state
    expect(screen.getByRole('button', { name: 'M15' })).toBeInTheDocument()
  })

  it('renders the no_data placeholder when candles are empty (pending state)', async () => {
    mockCandles.mockResolvedValue(NO_DATA_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={3} resolvedTimeframes={RESOLVED_TFS} />,
    )

    expect(
      await screen.findByText('Chart data not yet available — will sync automatically'),
    ).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'M15' })).toBeInTheDocument()
  })

  it('calls chart API methods with correct data on success and renders the chart container', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={4} resolvedTimeframes={RESOLVED_TFS} />,
    )

    // Wait until the chart effect has run
    await waitFor(() => {
      expect(mockCreateChart).toHaveBeenCalledOnce()
    })

    // A candlestick series was added
    expect(mockAddCandlestickSeries).toHaveBeenCalledOnce()

    // setData was called with time expressed in seconds (timestamp / 1000)
    expect(mockSetData).toHaveBeenCalledOnce()
    const seriesData = mockSetData.mock.calls[0]![0] as Array<{
      time: number
      open: number
      high: number
      low: number
      close: number
    }>
    expect(seriesData).toHaveLength(2)
    expect(seriesData[0]!.time).toBe(1_735_689_600_000 / 1000)
    expect(seriesData[1]!.time).toBe(1_735_690_500_000 / 1000)

    // Markers were set (entry + exit)
    expect(mockSetMarkers).toHaveBeenCalledOnce()
    const markers = mockSetMarkers.mock.calls[0]![0] as Array<{ text: string }>
    expect(markers).toHaveLength(2)
    const markerTexts = markers.map((m) => m.text)
    expect(markerTexts).toContain('entry')
    expect(markerTexts).toContain('exit')

    // createPriceLine called for stop_loss and one take_profit
    expect(mockCreatePriceLine).toHaveBeenCalledTimes(2)
    const slCall = mockCreatePriceLine.mock.calls.find(
      (args) => (args[0] as { title: string }).title === 'SL',
    )
    expect(slCall).toBeDefined()
    expect((slCall![0] as { price: number }).price).toBe(1.08000)

    // fitContent was called to fit the time scale
    expect(mockFitContent).toHaveBeenCalledOnce()

    // The chart container div is present in the document
    const chartContainer = document.querySelector('[class*="container"]')
    expect(chartContainer).not.toBeNull()
  })

  it('disables the TradingView attribution logo and uses a 450px chart height', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={6} resolvedTimeframes={RESOLVED_TFS} />,
    )

    await waitFor(() => {
      expect(mockCreateChart).toHaveBeenCalledOnce()
    })

    const options = (mockCreateChart.mock.calls[0] as unknown[])[1] as {
      height: number
      layout: { attributionLogo: boolean }
    }
    expect(options.height).toBe(450)
    expect(options.layout.attributionLogo).toBe(false)
  })

  it('re-applies chart and series colors when the color scheme toggles', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    function ColorSchemeToggle() {
      const { setColorScheme } = useMantineColorScheme()
      return (
        <button type="button" onClick={() => setColorScheme('dark')}>
          to-dark
        </button>
      )
    }

    renderWithProviders(
      <>
        <ColorSchemeToggle />
        <TradeChart tradeId={7} resolvedTimeframes={RESOLVED_TFS} />
      </>,
    )

    // Wait until the chart and series have been created.
    await waitFor(() => {
      expect(mockAddCandlestickSeries).toHaveBeenCalledOnce()
    })

    // The theme effect has not fired yet (no scheme change since creation).
    expect(mockSeriesApplyOptions).not.toHaveBeenCalled()

    // Toggle the Mantine color scheme.
    fireEvent.click(screen.getByRole('button', { name: 'to-dark' }))

    // Both the chart layout/grid and the series candle colors are re-applied.
    await waitFor(() => {
      expect(mockSeriesApplyOptions).toHaveBeenCalled()
    })
    const seriesColors = mockSeriesApplyOptions.mock.calls.at(-1)![0] as {
      upColor: string
      downColor: string
    }
    expect(seriesColors).toHaveProperty('upColor')
    expect(seriesColors).toHaveProperty('downColor')

    const chartOptions = mockApplyOptions.mock.calls.at(-1)![0] as {
      layout?: { textColor?: string }
    }
    expect(chartOptions.layout).toBeDefined()
  })

  it('re-fetches with the new resolution when a timeframe button is clicked', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={5} resolvedTimeframes={RESOLVED_TFS} />,
    )

    // Wait for the initial M15 fetch to complete
    await waitFor(() => {
      expect(mockCandles).toHaveBeenCalledWith(5, 'M15', expect.anything())
    })

    // Select H1 in the timeframe button row
    fireEvent.click(screen.getByRole('button', { name: 'H1' }))

    // The fetch effect re-runs when the resolution changes; assert the new fetch
    await waitFor(() => {
      expect(mockCandles).toHaveBeenCalledWith(5, 'H1', expect.anything())
    })
  })

  it('defaults the active timeframe to the entry timeframe (is_entry)', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={10} resolvedTimeframes={RESOLVED_TFS} />,
    )

    // The first fetch targets M15 — the only is_entry timeframe — not the
    // first (heaviest) entry H1 in the list.
    await waitFor(() => {
      expect(mockCandles).toHaveBeenCalledWith(10, 'M15', expect.anything())
    })
    expect(mockCandles).not.toHaveBeenCalledWith(10, 'H1', expect.anything())
  })

  it('serves a revisited timeframe from cache without re-fetching', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={11} resolvedTimeframes={RESOLVED_TFS} />,
    )

    // Initial entry (M15) fetch.
    await waitFor(() => {
      expect(mockCandles).toHaveBeenCalledWith(11, 'M15', expect.anything())
    })

    // Visit H1 (cache miss → one fetch).
    fireEvent.click(screen.getByRole('button', { name: 'H1' }))
    await waitFor(() => {
      expect(mockCandles).toHaveBeenCalledWith(11, 'H1', expect.anything())
    })

    // Return to M15 — already cached, so no second M15 request is issued.
    fireEvent.click(screen.getByRole('button', { name: 'M15' }))
    await waitFor(() => {
      expect(mockCandles).toHaveBeenCalledWith(11, 'H1', expect.anything())
    })
    const m15Calls = mockCandles.mock.calls.filter((c) => c[1] === 'M15')
    expect(m15Calls).toHaveLength(1)
  })

  it('marks the entry timeframe button with the entry indicator class', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={12} resolvedTimeframes={RESOLVED_TFS} />,
    )

    // M15 is the entry timeframe; H1 is not.
    expect(screen.getByRole('button', { name: 'M15' }).className).toMatch(/entryButton/)
    expect(screen.getByRole('button', { name: 'H1' }).className).not.toMatch(/entryButton/)
  })

  it('falls back to a single timeframe button when none are resolved', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={13} resolvedTimeframes={[]} fallbackResolution="M15" />,
    )

    // Only the fallback button is rendered, and it drives the initial fetch.
    await waitFor(() => {
      expect(mockCandles).toHaveBeenCalledWith(13, 'M15', expect.anything())
    })
    expect(screen.getByRole('button', { name: 'M15' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'H1' })).not.toBeInTheDocument()
  })

  it('fires a single effective candle request under StrictMode double-mount', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <StrictMode>
        <TradeChart tradeId={8} resolvedTimeframes={RESOLVED_TFS} />
      </StrictMode>,
    )

    // The chart is built once the surviving request resolves.
    await waitFor(() => {
      expect(mockCreateChart).toHaveBeenCalled()
    })

    // StrictMode mounts, unmounts (aborting the first request), then remounts.
    // That yields at most one extra in-flight request — never the triple seen
    // when a ref-based "skip first render" guard re-triggered reload() (#231).
    expect(mockCandles.mock.calls.length).toBeLessThanOrEqual(2)

    // Every request targeted the same resolution; none was a stray reload.
    for (const call of mockCandles.mock.calls) {
      expect(call[0]).toBe(8)
      expect(call[1]).toBe('M15')
    }
  })
})
