import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  useMantineColorScheme,
} from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useFetch } from '@/hooks/useFetch'
import { tradesApi } from '@/services/trades'
import type { TradeCandlesResponse } from '@/types/candle'
import { CHART_RESOLUTIONS, type ChartResolution } from '@/types/candle'
import classes from './TradeChart.module.css'

export interface TradeChartProps {
  tradeId: number
  defaultResolution: string
}

function isValidResolution(value: string): value is ChartResolution {
  return (CHART_RESOLUTIONS as string[]).includes(value)
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

export function TradeChart({ tradeId, defaultResolution }: TradeChartProps) {
  const { t } = useTranslation()
  const { colorScheme } = useMantineColorScheme()

  const [resolution, setResolution] = useState<ChartResolution>(
    isValidResolution(defaultResolution) ? defaultResolution : 'M15',
  )

  const fetcher = useCallback(
    (signal: AbortSignal) => tradesApi.candles(tradeId, resolution, signal),
    [tradeId, resolution],
  )

  const { data: response, loading, error, reload } = useFetch<TradeCandlesResponse>(fetcher)

  // useFetch only re-fetches on nonce bump (reload). Re-fetch when resolution
  // changes after mount by calling reload(). The initial mount fetch is
  // handled by useFetch itself (nonce starts at 0).
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    reload()
  }, [resolution, reload])

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

  const resolutionData = CHART_RESOLUTIONS.map((r) => ({ value: r, label: r }))

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
      <SegmentedControl
        size="xs"
        data={resolutionData}
        value={resolution}
        onChange={(v) => {
          if (isValidResolution(v)) setResolution(v)
        }}
      />
      {content}
    </Stack>
  )
}
