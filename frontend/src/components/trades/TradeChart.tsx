import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type UTCTimestamp,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
} from 'lightweight-charts'
import {
  Alert,
  Button,
  Skeleton,
  Stack,
  Text,
  useMantineColorScheme,
} from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { tradesApi } from '@/services/trades'
import type { TradeCandlesResponse } from '@/types/candle'
import type { ResolvedTimeframe } from '@/types/trade'
import classes from './TradeChart.module.css'

export interface TradeChartProps {
  tradeId: number
  /**
   * Timeframe buttons for the chart viewer, pre-sorted by weight descending
   * (D1 first, M1 last) by the backend. Drives both the button row and the
   * default active resolution (the one flagged `is_entry`).
   */
  resolvedTimeframes: ResolvedTimeframe[]
  /**
   * Ultimate fallback resolution for legacy trades that have neither resolved
   * chart timeframes nor an entry timeframe set. Defaults to 'M15'.
   */
  fallbackResolution?: string
}

interface ChartColors {
  bg: string
  text: string
  grid: string
  green: string
  red: string
}

// Resolve theme-aware colors from the container's computed style. Mantine's
// semantic CSS variables (--mantine-color-body / text / default-border) resolve
// to different values per color scheme, so re-reading them after a theme switch
// yields the correct palette for the active scheme.
function resolveChartColors(containerEl: HTMLElement): ChartColors {
  const style = getComputedStyle(containerEl)
  const get = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback
  return {
    bg: get('--mantine-color-body', 'transparent'),
    text: get('--mantine-color-text', '#a6a7ab'),
    grid: get('--mantine-color-default-border', '#373a40'),
    green: get('--mantine-color-green-6', '#40c057'),
    red: get('--mantine-color-red-6', '#fa5252'),
  }
}

export function TradeChart({
  tradeId,
  resolvedTimeframes,
  fallbackResolution = 'M15',
}: TradeChartProps) {
  const { t } = useTranslation()
  const { colorScheme } = useMantineColorScheme()

  // The button row: the backend-sorted resolved timeframes, or a single
  // synthesized entry when none are available (legacy trades).
  const timeframes = useMemo<ResolvedTimeframe[]>(
    () =>
      resolvedTimeframes.length > 0
        ? resolvedTimeframes
        : [{ unit: '', value: 0, resolution: fallbackResolution, is_entry: true }],
    [resolvedTimeframes, fallbackResolution],
  )

  // Default active resolution: the entry timeframe, else the first (heaviest)
  // resolved timeframe, else the legacy fallback.
  const [resolution, setResolution] = useState<string>(() => {
    const entry = resolvedTimeframes.find((tf) => tf.is_entry)
    if (entry) return entry.resolution
    if (resolvedTimeframes.length > 0) return resolvedTimeframes[0]!.resolution
    return fallbackResolution
  })

  // Lazy-loading caches keyed by resolution string. A TF button click serves
  // from here when present (success or error), fetching only on a miss.
  const [responsesByResolution, setResponsesByResolution] = useState<
    Record<string, TradeCandlesResponse>
  >({})
  const [errorsByResolution, setErrorsByResolution] = useState<Record<string, string>>({})

  const response = responsesByResolution[resolution] ?? null
  const error = errorsByResolution[resolution] ?? null
  // A resolution with neither a cached response nor a cached error is in flight.
  const loading = response === null && error === null

  // Fetch candles for the active resolution unless already resolved (cached or
  // errored). The cache is the guard, so switching back to a visited TF skips
  // the network entirely. StrictMode's double-mount aborts the first request in
  // cleanup, so at most one effective request lands. State is only set inside
  // the async callbacks, never synchronously, so an extra render is avoided.
  useEffect(() => {
    if (responsesByResolution[resolution] || errorsByResolution[resolution]) {
      return
    }

    const controller = new AbortController()

    tradesApi
      .candles(tradeId, resolution, controller.signal)
      .then((resp) => {
        if (controller.signal.aborted) return
        setResponsesByResolution((prev) => ({ ...prev, [resolution]: resp }))
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setErrorsByResolution((prev) => ({
          ...prev,
          [resolution]: cause instanceof Error ? cause.message : t('common.status.error'),
        }))
      })

    return () => controller.abort()
  }, [tradeId, resolution, responsesByResolution, errorsByResolution, t])

  // Drop the active resolution's cached response and error so the fetch effect
  // re-runs. Replacing the object references re-triggers it even when nothing
  // was cached.
  const reload = useCallback(() => {
    setErrorsByResolution((prev) => {
      const next = { ...prev }
      delete next[resolution]
      return next
    })
    setResponsesByResolution((prev) => {
      const next = { ...prev }
      delete next[resolution]
      return next
    })
  }, [resolution])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    const containerEl = containerRef.current
    const candles = response?.data?.candles

    if (!containerEl || !candles || candles.length === 0) {
      return
    }

    const data = response?.data
    if (!data) {
      return
    }

    const colors = resolveChartColors(containerEl)

    // Derive price format from magnitude of first candle's close
    const firstCandle = candles[0]
    const isForex = firstCandle ? firstCandle.close < 100 : true
    const precision = isForex ? 5 : 2
    const minMove = isForex ? 0.00001 : 0.01

    const chart = createChart(containerEl, {
      height: 450,
      width: containerEl.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: colors.grid,
      },
      rightPriceScale: {
        borderColor: colors.grid,
      },
    })

    chartRef.current = chart

    const series = chart.addCandlestickSeries({
      upColor: colors.green,
      downColor: colors.red,
      borderUpColor: colors.green,
      borderDownColor: colors.red,
      wickUpColor: colors.green,
      wickDownColor: colors.red,
      priceFormat: {
        type: 'price',
        precision,
        minMove,
      },
    })

    seriesRef.current = series

    series.setData(
      candles.map((c) => ({
        time: (c.timestamp / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )

    // Markers — must be sorted ascending by time
    const markers: SeriesMarker<UTCTimestamp>[] = data.markers
      .map((m) => ({
        time: (m.timestamp / 1000) as UTCTimestamp,
        position: m.type === 'entry' ? ('belowBar' as const) : ('aboveBar' as const),
        color: m.type === 'entry' ? colors.green : colors.red,
        shape: m.type === 'entry' ? ('arrowUp' as const) : ('arrowDown' as const),
        text: m.type,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number))

    series.setMarkers(markers)

    // Price levels
    if (data.levels.stop_loss !== null) {
      series.createPriceLine({
        price: data.levels.stop_loss,
        color: colors.red,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'SL',
      })
    }

    const tps = data.levels.take_profits
    tps.forEach((tp, i) => {
      series.createPriceLine({
        price: tp,
        color: colors.green,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: tps.length > 1 ? `TP${i + 1}` : 'TP',
      })
    })

    chart.timeScale().fitContent()

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: containerEl.clientWidth })
    })
    resizeObserver.observe(containerEl)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [response])

  // Re-apply theme-aware colors when the Mantine color scheme toggles. The
  // create effect only runs on data change, so without this the chart keeps the
  // colors resolved at creation time after a dark <-> light switch.
  useEffect(() => {
    const containerEl = containerRef.current
    const chart = chartRef.current
    const series = seriesRef.current
    if (!containerEl || !chart || !series) {
      return
    }

    const colors = resolveChartColors(containerEl)
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      timeScale: { borderColor: colors.grid },
      rightPriceScale: { borderColor: colors.grid },
    })
    series.applyOptions({
      upColor: colors.green,
      downColor: colors.red,
      borderUpColor: colors.green,
      borderDownColor: colors.red,
      wickUpColor: colors.green,
      wickDownColor: colors.red,
    })
  }, [colorScheme])

  let content: ReactNode
  if (loading) {
    content = <Skeleton height={450} />
  } else if (error) {
    content = (
      <Alert
        color="orange"
        icon={<IconAlertTriangle size={20} />}
        title={t('common.status.error')}
      >
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{error}</Text>
          <Button variant="default" size="xs" onClick={reload}>
            {t('common.actions.retry')}
          </Button>
        </Stack>
      </Alert>
    )
  } else if (response?.data === null && response?.meta?.reason === 'no_ticker') {
    // no_ticker — data is null and meta indicates no ticker linked
    content = (
      <div className={classes.placeholder}>
        <Text size="sm" c="dimmed">
          {t('trade.detail.chart.no_ticker')}
        </Text>
      </div>
    )
  } else if ((response?.data?.candles.length ?? 0) === 0) {
    // pending — data present but candles array is empty
    content = (
      <div className={classes.placeholder}>
        <Text size="sm" c="dimmed">
          {t('trade.detail.chart.no_data')}
        </Text>
      </div>
    )
  } else {
    content = <div ref={containerRef} className={classes.container} />
  }

  return (
    <Stack gap="sm">
      <Button.Group>
        {timeframes.map((tf) => {
          const active = tf.resolution === resolution
          return (
            <Button
              key={tf.resolution}
              size="xs"
              variant={active ? 'filled' : 'default'}
              className={tf.is_entry ? classes.entryButton : undefined}
              loading={active && loading}
              onClick={() => setResolution(tf.resolution)}
            >
              {tf.resolution}
            </Button>
          )
        })}
      </Button.Group>
      {content}
    </Stack>
  )
}
