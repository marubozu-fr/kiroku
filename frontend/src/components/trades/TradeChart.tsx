import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type UTCTimestamp,
  type IChartApi,
  type SeriesMarker,
} from 'lightweight-charts'
import { Alert, Button, SegmentedControl, Skeleton, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useFetch } from '@/hooks/useFetch'
import { tradesApi } from '@/services/trades'
import type { TradeCandlesResponse } from '@/types/candle'
import { CHART_RESOLUTIONS, type ChartResolution } from '@/types/candle'
import classes from './TradeChart.module.css'

export interface TradeChartProps {
  tradeId: number
  assetName: string
  defaultResolution: string
}

function isValidResolution(value: string): value is ChartResolution {
  return (CHART_RESOLUTIONS as string[]).includes(value)
}

export function TradeChart({ tradeId, defaultResolution }: TradeChartProps) {
  const { t } = useTranslation()

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

    const style = getComputedStyle(containerEl)
    const bgColor = style.getPropertyValue('--mantine-color-body').trim() || 'transparent'
    const textColor = style.getPropertyValue('--mantine-color-dark-2').trim() || '#a6a7ab'
    const gridColor = style.getPropertyValue('--mantine-color-dark-4').trim() || '#373a40'
    const greenColor = style.getPropertyValue('--mantine-color-green-6').trim() || '#40c057'
    const redColor = style.getPropertyValue('--mantine-color-red-6').trim() || '#fa5252'

    // Derive price format from magnitude of first candle's close
    const firstCandle = candles[0]
    const isForex = firstCandle ? firstCandle.close < 100 : true
    const precision = isForex ? 5 : 2
    const minMove = isForex ? 0.00001 : 0.01

    const chart = createChart(containerEl, {
      height: 320,
      width: containerEl.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: gridColor,
      },
      rightPriceScale: {
        borderColor: gridColor,
      },
    })

    chartRef.current = chart

    const series = chart.addCandlestickSeries({
      upColor: greenColor,
      downColor: redColor,
      borderUpColor: greenColor,
      borderDownColor: redColor,
      wickUpColor: greenColor,
      wickDownColor: redColor,
      priceFormat: {
        type: 'price',
        precision,
        minMove,
      },
    })

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
        color: m.type === 'entry' ? greenColor : redColor,
        shape: m.type === 'entry' ? ('arrowUp' as const) : ('arrowDown' as const),
        text: m.type,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number))

    series.setMarkers(markers)

    // Price levels
    if (data.levels.stop_loss !== null) {
      series.createPriceLine({
        price: data.levels.stop_loss,
        color: redColor,
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
        color: greenColor,
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
    }
  }, [response])

  const resolutionData = CHART_RESOLUTIONS.map((r) => ({ value: r, label: r }))

  if (loading) {
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
        <Skeleton height={320} />
      </Stack>
    )
  }

  if (error) {
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
      </Stack>
    )
  }

  // no_ticker — data is null and meta indicates no ticker linked
  if (response?.data === null && response?.meta?.reason === 'no_ticker') {
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
        <div className={classes.placeholder}>
          <Text size="sm" c="dimmed">
            {t('trade.detail.chart.no_ticker')}
          </Text>
        </div>
      </Stack>
    )
  }

  // pending — data present but candles array is empty
  if (response?.data !== null && (response?.data?.candles.length ?? 0) === 0) {
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
        <div className={classes.placeholder}>
          <Text size="sm" c="dimmed">
            {t('trade.detail.chart.no_data')}
          </Text>
        </div>
      </Stack>
    )
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
      <div ref={containerRef} className={classes.container} />
    </Stack>
  )
}
