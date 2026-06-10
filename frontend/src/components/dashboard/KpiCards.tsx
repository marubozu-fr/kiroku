import { useTranslation } from 'react-i18next'
import { Card, Group, SimpleGrid, Text } from '@mantine/core'
import type { DashboardStats } from '@/types/dashboard'
import { formatPercent, formatR, signedColor } from '@/components/journal/format'
import {
  formatProfitFactor,
  formatWinRate,
  profitFactorColor,
  winRateColor,
} from './format'

/** Display mode for financial values: R multiples or percentages. */
export type DisplayMode = 'r' | 'pct'

interface KpiCardsProps {
  stats: DashboardStats
  displayMode: DisplayMode
}

/**
 * Five KPI cards: Total Trades, Win Rate, Avg R, Profit Factor, Best / Worst.
 *
 * Colour rules follow docs/DESIGN_SYSTEM.md — green/red are reserved for P&L
 * and the win-rate / profit-factor thresholds. Total Trades is a count and is
 * never coloured. The R / % toggle only affects Avg R (the endpoint exposes no
 * percentage equivalent for the single-trade Best / Worst extremes, so those
 * stay in R rather than fabricating a value).
 */
export function KpiCards({ stats, displayMode }: KpiCardsProps) {
  const { t } = useTranslation()

  const avgPct = stats.total_trades === 0 ? 0 : stats.total_pct / stats.total_trades
  const avgValue = displayMode === 'pct' ? formatPercent(avgPct) : formatR(stats.avg_r)
  const avgColor = signedColor(displayMode === 'pct' ? avgPct : stats.avg_r)

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
      <KpiCard label={t('dashboard.kpi.total_trades')} value={String(stats.total_trades)} />
      <KpiCard
        label={t('dashboard.kpi.win_rate')}
        value={formatWinRate(stats.win_rate)}
        color={winRateColor(stats.win_rate)}
      />
      <KpiCard label={t('dashboard.kpi.avg_r')} value={avgValue} color={avgColor} />
      <KpiCard
        label={t('dashboard.kpi.profit_factor')}
        value={formatProfitFactor(stats.profit_factor)}
        color={profitFactorColor(stats.profit_factor)}
      />
      <Card padding="md" radius="md" withBorder>
        <Text size="sm" c="dimmed">
          {t('dashboard.kpi.best_worst')}
        </Text>
        <Group gap={6} wrap="nowrap">
          <Text size="xl" fw={700} ff="monospace" c={signedColor(stats.best_r)}>
            {formatR(stats.best_r)}
          </Text>
          <Text size="xl" fw={700} ff="monospace" c="dimmed">
            /
          </Text>
          <Text size="xl" fw={700} ff="monospace" c={signedColor(stats.worst_r)}>
            {formatR(stats.worst_r)}
          </Text>
        </Group>
      </Card>
    </SimpleGrid>
  )
}

interface KpiCardProps {
  label: string
  value: string
  color?: string
}

function KpiCard({ label, value, color }: KpiCardProps) {
  return (
    <Card padding="md" radius="md" withBorder>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="xl" fw={700} ff="monospace" c={color}>
        {value}
      </Text>
    </Card>
  )
}
