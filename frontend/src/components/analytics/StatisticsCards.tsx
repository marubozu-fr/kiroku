import { useTranslation } from 'react-i18next'
import { Card, Group, SimpleGrid, Text } from '@mantine/core'
import { formatR, signedColor } from '@/components/journal/format'
import {
  formatProfitFactor,
  formatWinRate,
  profitFactorColor,
  winRateColor,
} from '@/components/dashboard/format'
import type { StatisticsData } from '@/types/analytics'
import { formatDuration } from './format'

interface StatisticsCardsProps {
  statistics: StatisticsData
}

/**
 * Two-row KPI grid for the Analytics page.
 *
 * Main row (4 cards): Total Trades, Total P&L, Win Rate, Profit Factor.
 * Secondary row (7 cards): Avg P&L, Avg Win, Avg Loss, Expectancy,
 * Avg Duration, Best/Worst, Win/Loss Streak.
 *
 * Color rules follow docs/DESIGN_SYSTEM.md — green/red for P&L and
 * win-rate/profit-factor thresholds only. Counts and durations are neutral.
 */
export function StatisticsCards({ statistics: s }: StatisticsCardsProps) {
  const { t } = useTranslation()

  const profitFactorValue =
    s.profit_factor === null
      ? { label: '—', color: 'dimmed' as string }
      : {
          label: formatProfitFactor(s.profit_factor),
          color: profitFactorColor(s.profit_factor),
        }

  return (
    <>
      {/* Main row */}
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <KpiCard label={t('analytics.kpi.total_trades')} value={String(s.total_trades)} />
        <KpiCard
          label={t('analytics.kpi.total_pnl')}
          value={formatR(s.total_pnl)}
          color={signedColor(s.total_pnl)}
        />
        <KpiCard
          label={t('analytics.kpi.win_rate')}
          value={formatWinRate(s.win_rate)}
          color={winRateColor(s.win_rate)}
        />
        <KpiCard
          label={t('analytics.kpi.profit_factor')}
          value={profitFactorValue.label}
          color={profitFactorValue.color}
        />
      </SimpleGrid>

      {/* Secondary row */}
      <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }}>
        <KpiCard
          label={t('analytics.kpi.avg_pnl')}
          value={formatR(s.avg_pnl)}
          color={signedColor(s.avg_pnl)}
          size="lg"
        />
        <KpiCard
          label={t('analytics.kpi.avg_win')}
          value={formatR(s.avg_win)}
          color={signedColor(s.avg_win)}
          size="lg"
        />
        <KpiCard
          label={t('analytics.kpi.avg_loss')}
          value={formatR(s.avg_loss)}
          color={signedColor(s.avg_loss)}
          size="lg"
        />
        <KpiCard
          label={t('analytics.kpi.expectancy')}
          value={formatR(s.expectancy)}
          color={signedColor(s.expectancy)}
          size="lg"
        />
        <KpiCard
          label={t('analytics.kpi.avg_duration')}
          value={formatDuration(s.avg_duration_hours)}
          size="lg"
        />

        {/* Best / Worst — two values in one card */}
        <Card padding="md" radius="md" withBorder>
          <Text size="sm" c="dimmed">
            {t('analytics.kpi.best_worst')}
          </Text>
          <Group gap={6} wrap="nowrap">
            <Text size="lg" fw={700} ff="monospace" c={signedColor(s.best_trade)}>
              {formatR(s.best_trade)}
            </Text>
            <Text size="lg" fw={700} ff="monospace" c="dimmed">
              /
            </Text>
            <Text size="lg" fw={700} ff="monospace" c={signedColor(s.worst_trade)}>
              {formatR(s.worst_trade)}
            </Text>
          </Group>
        </Card>

        {/* Win / Loss Streak — two counts in one card, neutral (never green/red) */}
        <Card padding="md" radius="md" withBorder>
          <Text size="sm" c="dimmed">
            {t('analytics.kpi.streak')}
          </Text>
          <Group gap={6} wrap="nowrap">
            <Text size="lg" fw={700} ff="monospace">
              {s.winning_streak}
            </Text>
            <Text size="lg" fw={700} ff="monospace" c="dimmed">
              /
            </Text>
            <Text size="lg" fw={700} ff="monospace">
              {s.losing_streak}
            </Text>
          </Group>
        </Card>
      </SimpleGrid>
    </>
  )
}

interface KpiCardProps {
  label: string
  value: string
  color?: string
  size?: 'xl' | 'lg'
}

function KpiCard({ label, value, color, size = 'xl' }: KpiCardProps) {
  return (
    <Card padding="md" radius="md" withBorder>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size={size} fw={700} ff="monospace" c={color}>
        {value}
      </Text>
    </Card>
  )
}
