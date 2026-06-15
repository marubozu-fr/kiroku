import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Center, Text } from '@mantine/core'
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
import { formatR, signedColor } from '@/components/journal/format'
import { formatProfitFactor, formatWinRate } from '@/components/dashboard/format'
import styles from './BreakdownChart.module.css'

export interface BreakdownChartItem {
  id: number
  label: string
  total_trades: number
  winning_trades: number
  win_rate: number
  total_pnl: number
  avg_pnl: number
  profit_factor: number | null
}

/** Internal shape with a computed bar fill added. */
interface ChartEntry extends BreakdownChartItem {
  fill: string
}

interface BreakdownChartProps {
  title: string
  items: BreakdownChartItem[]
  emptyMessage: string
}

const MAX_ITEMS = 10

function buildEntries(items: BreakdownChartItem[]): ChartEntry[] {
  const sorted = [...items].sort((a, b) => {
    const diff = b.total_trades - a.total_trades
    if (diff !== 0) return diff
    return a.label.localeCompare(b.label)
  })

  const top = sorted.slice(0, MAX_ITEMS)
  const rest = sorted.slice(MAX_ITEMS)

  const result: ChartEntry[] = top.map((item) => ({
    ...item,
    fill: item.total_pnl >= 0 ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)',
  }))

  if (rest.length > 0) {
    const othersLabel = 'Others' // resolved via t() in the tooltip; label set below
    const total_trades = rest.reduce((sum, i) => sum + i.total_trades, 0)
    const winning_trades = rest.reduce((sum, i) => sum + i.winning_trades, 0)
    const total_pnl = rest.reduce((sum, i) => sum + i.total_pnl, 0)
    const avg_pnl = total_trades > 0 ? total_pnl / total_trades : 0
    const win_rate = total_trades > 0 ? (winning_trades / total_trades) * 100 : 0
    result.push({
      id: -1,
      label: othersLabel,
      total_trades,
      winning_trades,
      win_rate,
      total_pnl,
      avg_pnl,
      profit_factor: null,
      fill: total_pnl >= 0 ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)',
    })
  }

  return result
}

function makeTooltip() {
  return function BreakdownTooltip({ active, payload }: TooltipContentProps) {
    const { t } = useTranslation()

    if (!active || !payload || payload.length === 0) {
      return null
    }

    const entry = payload[0]?.payload as ChartEntry
    const label = entry.id === -1 ? t('analytics.breakdown.others') : entry.label

    return (
      <div className={styles.tooltip}>
        <Text size="sm" fw={600}>
          {label}
        </Text>
        <div className={styles.tooltipRow}>
          <Text size="xs" c="dimmed">
            {t('analytics.breakdown.tooltip.trades')}
          </Text>
          <Text size="xs" ff="monospace">
            {String(entry.total_trades)}
          </Text>
        </div>
        <div className={styles.tooltipRow}>
          <Text size="xs" c="dimmed">
            {t('analytics.breakdown.tooltip.win_rate')}
          </Text>
          <Text size="xs" ff="monospace">
            {formatWinRate(entry.win_rate)}
          </Text>
        </div>
        <div className={styles.tooltipRow}>
          <Text size="xs" c="dimmed">
            {t('analytics.breakdown.tooltip.avg_pnl')}
          </Text>
          <Text size="xs" ff="monospace" c={signedColor(entry.avg_pnl)}>
            {formatR(entry.avg_pnl)}
          </Text>
        </div>
        <div className={styles.tooltipRow}>
          <Text size="xs" c="dimmed">
            {t('analytics.breakdown.tooltip.profit_factor')}
          </Text>
          <Text size="xs" ff="monospace">
            {entry.profit_factor === null ? '—' : formatProfitFactor(entry.profit_factor)}
          </Text>
        </div>
      </div>
    )
  }
}

export function BreakdownChart({ title, items, emptyMessage }: BreakdownChartProps) {
  const { t } = useTranslation()
  const TooltipContent = useMemo(() => makeTooltip(), [])

  const entries = useMemo(() => buildEntries(items), [items])

  const resolvedEntries = entries.map((e) => ({
    ...e,
    label: e.id === -1 ? t('analytics.breakdown.others') : e.label,
  }))

  return (
    <Card padding="md" radius="md" withBorder>
      <Text fw={600} mb="sm">
        {title}
      </Text>

      {items.length === 0 && (
        <Center py="md">
          <Text c="dimmed" size="sm">
            {emptyMessage}
          </Text>
        </Center>
      )}

      {items.length === 1 && (
        <Center py="md">
          <Text c="dimmed" size="sm">
            {t('analytics.breakdown.need_more')}
          </Text>
        </Center>
      )}

      {items.length >= 2 && (
        <ResponsiveContainer
          width="100%"
          height={Math.max(180, resolvedEntries.length * 44)}
        >
          <BarChart
            data={resolvedEntries}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--mantine-color-default-border)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--mantine-color-default-border)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={80}
              tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={TooltipContent}
              cursor={{ fill: 'var(--mantine-color-default-hover)' }}
            />
            {/* Per-bar colours come from each entry's `fill` field (set in
                buildEntries) — recharts reads it automatically. */}
            <Bar dataKey="total_pnl" radius={[0, 3, 3, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
