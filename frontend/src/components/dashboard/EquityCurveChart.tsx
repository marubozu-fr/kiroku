import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Center, Text } from '@mantine/core'
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
import type { EquityDataPoint } from '@/types/dashboard'
import { formatLocalDate, formatPercent, formatR } from '@/components/journal/format'
import type { DisplayMode } from '@/components/dashboard/KpiCards'
import styles from './ChartTooltip.module.css'

interface EquityCurveChartProps {
  data: EquityDataPoint[]
  displayMode: DisplayMode
}

interface ChartEntry extends EquityDataPoint {
  value: number
  shortDate: string
}

function buildChartEntries(
  data: EquityDataPoint[],
  displayMode: DisplayMode,
): ChartEntry[] {
  return data.map((d) => ({
    ...d,
    value: displayMode === 'r' ? d.cumulative_r : d.cumulative_pct,
    shortDate: formatLocalDate(d.date, 'MMM D'),
  }))
}

function makeTooltip(displayMode: DisplayMode) {
  return function ChartTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload || payload.length === 0) {
      return null
    }

    const entry = payload[0]?.payload as ChartEntry
    const formatted =
      displayMode === 'r' ? formatR(entry.cumulative_r) : formatPercent(entry.cumulative_pct)

    return (
      <div className={styles.tooltip}>
        <Text size="xs" c="dimmed">
          {entry.shortDate}
        </Text>
        <Text size="sm" fw={600} ff="monospace">
          {formatted}
        </Text>
      </div>
    )
  }
}

export function EquityCurveChart({ data, displayMode }: EquityCurveChartProps) {
  const { t } = useTranslation()
  const TooltipContent = useMemo(() => makeTooltip(displayMode), [displayMode])

  if (data.length === 0) {
    return (
      <Center h={300}>
        <Text c="dimmed">{t('dashboard.charts.empty')}</Text>
      </Center>
    )
  }

  const entries = buildChartEntries(data, displayMode)
  const gradientId = 'equityGradient'

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={entries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--mantine-color-default-border)"
          vertical={false}
        />
        <XAxis
          dataKey="shortDate"
          tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--mantine-color-default-border)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine
          y={0}
          stroke="var(--mantine-color-dimmed)"
          strokeDasharray="4 4"
        />
        <Tooltip
          content={TooltipContent}
          cursor={{ stroke: 'var(--mantine-color-dimmed)', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--mantine-color-blue-6)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: 'var(--mantine-color-blue-6)' }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
