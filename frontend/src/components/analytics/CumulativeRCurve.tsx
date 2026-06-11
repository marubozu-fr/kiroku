import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Center, Text } from '@mantine/core'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { formatR, formatLocalDate, signedColor } from '@/components/journal/format'
import type { CumulativeRPoint } from '@/types/analytics'
import styles from './CumulativeRCurve.module.css'

interface CumulativeRCurveProps {
  data: CumulativeRPoint[]
}

function makeTooltip() {
  return function CumulativeRTooltip({ active, payload }: TooltipContentProps) {
    const { t } = useTranslation()

    if (!active || !payload || payload.length === 0) {
      return null
    }

    const point = payload[0].payload as CumulativeRPoint

    return (
      <div className={styles.tooltip}>
        <Text size="sm" fw={600}>
          {t('analytics.charts.cumulative_r.tooltip.date')}:{' '}
          {formatLocalDate(point.trade_date)}
        </Text>
        <div className={styles.tooltipRow}>
          <Text size="xs" c="dimmed">
            {t('analytics.charts.cumulative_r.tooltip.trade_pnl')}
          </Text>
          <Text size="xs" ff="monospace" c={signedColor(point.performance_r)}>
            {formatR(point.performance_r)}
          </Text>
        </div>
        <div className={styles.tooltipRow}>
          <Text size="xs" c="dimmed">
            {t('analytics.charts.cumulative_r.tooltip.cumulative')}
          </Text>
          <Text size="xs" ff="monospace" c={signedColor(point.cumulative_r)}>
            {formatR(point.cumulative_r)}
          </Text>
        </div>
      </div>
    )
  }
}

export function CumulativeRCurve({ data }: CumulativeRCurveProps) {
  const { t } = useTranslation()

  const TooltipContent = useMemo(() => makeTooltip(), [])

  // Offset (0-1) along the Y-axis domain where cumulative_r crosses 0.
  // The gradient renders top-to-bottom, so it is green above 0 and red below.
  const zeroOffset = useMemo(() => {
    if (data.length === 0) {
      return 1
    }
    const values = data.map((point) => point.cumulative_r)
    const max = Math.max(...values)
    const min = Math.min(...values)
    if (max <= 0) {
      return 0
    }
    if (min >= 0) {
      return 1
    }
    return max / (max - min)
  }, [data])

  if (data.length === 0) {
    return (
      <Card padding="md" radius="md" withBorder>
        <Text fw={600} mb="sm">
          {t('analytics.charts.cumulative_r.title')}
        </Text>
        <Center py="md">
          <Text c="dimmed" size="sm">
            {t('analytics.charts.cumulative_r.empty')}
          </Text>
        </Center>
      </Card>
    )
  }

  return (
    <Card padding="md" radius="md" withBorder>
      <Text fw={600} mb="sm">
        {t('analytics.charts.cumulative_r.title')}
      </Text>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <defs>
            <linearGradient id="cumulativeRStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={zeroOffset} stopColor="var(--mantine-color-green-6)" />
              <stop offset={zeroOffset} stopColor="var(--mantine-color-red-6)" />
            </linearGradient>
            <linearGradient id="cumulativeRFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset={zeroOffset}
                stopColor="var(--mantine-color-green-6)"
                stopOpacity={0.3}
              />
              <stop
                offset={zeroOffset}
                stopColor="var(--mantine-color-red-6)"
                stopOpacity={0.3}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--mantine-color-default-border)"
            vertical={false}
          />
          <XAxis
            dataKey="trade_date"
            tickFormatter={(v: string) => formatLocalDate(v, 'MMM D')}
            tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--mantine-color-default-border)' }}
            tickLine={false}
            minTickGap={60}
          />
          <YAxis
            tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: t('analytics.charts.cumulative_r.y_axis'),
              angle: -90,
              position: 'insideLeft',
              fill: 'var(--mantine-color-dimmed)',
              fontSize: 11,
            }}
          />
          <Tooltip
            content={TooltipContent}
            cursor={{ stroke: 'var(--mantine-color-default-border)' }}
          />
          <ReferenceLine
            y={0}
            stroke="var(--mantine-color-default-border)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="cumulative_r"
            stroke="url(#cumulativeRStroke)"
            strokeWidth={2}
            fill="url(#cumulativeRFill)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}
