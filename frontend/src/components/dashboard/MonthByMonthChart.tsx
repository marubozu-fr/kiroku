import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Center, Text } from '@mantine/core'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { MonthlyDataPoint } from '@/types/dashboard'
import { formatPercent, formatR } from '@/components/journal/format'
import type { DisplayMode } from '@/components/dashboard/KpiCards'
import styles from './ChartTooltip.module.css'

interface MonthByMonthChartProps {
  data: MonthlyDataPoint[]
  displayMode: DisplayMode
}

/** MonthlyDataPoint extended with a computed display label, value and bar fill. */
interface ChartEntry extends MonthlyDataPoint {
  label: string
  value: number
  fill: string
}

/** Build a short 2-digit suffix when data spans multiple distinct years. */
function buildChartEntries(
  data: MonthlyDataPoint[],
  displayMode: DisplayMode,
): ChartEntry[] {
  const years = new Set(data.map((d) => d.year))
  const multiYear = years.size > 1
  return data.map((d) => {
    const value = displayMode === 'r' ? d.value_r : d.value_pct
    return {
      ...d,
      label: multiYear ? `${d.month_label} ${String(d.year).slice(-2)}` : d.month_label,
      value,
      fill: value >= 0 ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)',
    }
  })
}

function makeTooltip(displayMode: DisplayMode) {
  return function ChartTooltip({ active, payload }: TooltipContentProps) {
    const { t } = useTranslation()

    if (!active || !payload || payload.length === 0) {
      return null
    }

    const entry = payload[0]?.payload as ChartEntry
    const formatted =
      displayMode === 'r' ? formatR(entry.value_r) : formatPercent(entry.value_pct)

    return (
      <div className={styles.tooltip}>
        <Text size="sm" fw={600}>
          {entry.label}
        </Text>
        <Text size="sm" ff="monospace">
          {formatted}
        </Text>
        <Text size="xs" c="dimmed">
          {t('dashboard.charts.tooltip.trades', { count: entry.trade_count })}
        </Text>
      </div>
    )
  }
}

export function MonthByMonthChart({ data, displayMode }: MonthByMonthChartProps) {
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

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={entries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--mantine-color-default-border)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--mantine-color-default-border)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={TooltipContent}
          cursor={{ fill: 'var(--mantine-color-default-hover)' }}
        />
        {/* Per-bar colours come from each entry's `fill` field (set in
            buildChartEntries) — recharts reads it automatically. */}
        <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
