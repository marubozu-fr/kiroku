import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMantineColorScheme } from '@mantine/core'
import type { TradeCandlesResponse } from '@/types/candle'
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
  it('renders a Skeleton and the SegmentedControl while data is loading', async () => {
    // Never resolves during the test
    mockCandles.mockReturnValue(new Promise<TradeCandlesResponse>(() => undefined))

    renderWithProviders(
      <TradeChart tradeId={1} defaultResolution="M15" />,
    )

    // Mantine Skeleton renders as a div with the mantine-Skeleton-root class
    await waitFor(() => {
      const skeleton = document.querySelector('.mantine-Skeleton-root')
      expect(skeleton).not.toBeNull()
    })

    // All resolution segments are visible
    expect(screen.getByRole('radio', { name: 'M15' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'H1' })).toBeInTheDocument()
  })

  it('renders the no_ticker placeholder when the asset has no linked ticker', async () => {
    mockCandles.mockResolvedValue(NO_TICKER_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={2} defaultResolution="M15" />,
    )

    expect(
      await screen.findByText(
        'Link this asset to a market data ticker in Settings to display charts',
      ),
    ).toBeInTheDocument()

    // SegmentedControl is present in every state
    expect(screen.getByRole('radio', { name: 'M15' })).toBeInTheDocument()
  })

  it('renders the no_data placeholder when candles are empty (pending state)', async () => {
    mockCandles.mockResolvedValue(NO_DATA_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={3} defaultResolution="M15" />,
    )

    expect(
      await screen.findByText('Chart data not yet available — will sync automatically'),
    ).toBeInTheDocument()

    expect(screen.getByRole('radio', { name: 'M15' })).toBeInTheDocument()
  })

  it('calls chart API methods with correct data on success and renders the chart container', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={4} defaultResolution="M15" />,
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
      <TradeChart tradeId={6} defaultResolution="M15" />,
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
        <TradeChart tradeId={7} defaultResolution="M15" />
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

  it('re-fetches with the new resolution when the SegmentedControl changes', async () => {
    mockCandles.mockResolvedValue(SUCCESS_RESPONSE)

    renderWithProviders(
      <TradeChart tradeId={5} defaultResolution="M15" />,
    )

    // Wait for the initial M15 fetch to complete
    await waitFor(() => {
      expect(mockCandles).toHaveBeenCalledWith(5, 'M15', expect.anything())
    })

    // Select H1 in the SegmentedControl
    fireEvent.click(screen.getByRole('radio', { name: 'H1' }))

    // The component calls reload() on resolution change; assert the new fetch
    await waitFor(() => {
      expect(mockCandles).toHaveBeenCalledWith(5, 'H1', expect.anything())
    })
  })
})
