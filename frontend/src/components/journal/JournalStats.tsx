import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, SimpleGrid, Text } from '@mantine/core'
import type { TradeSummary } from '@/types/trade'
import { formatR, signedColor } from './format'
import { computeStats } from './calendar'

interface JournalStatsProps {
  trades: TradeSummary[]
}

/**
 * Four stat cards displayed above the calendar/list view.
 *
 * - Total Trades: raw count, monospace, not colored.
 * - Total P&L: sum of non-null performance_r, green/red/dimmed.
 * - Win Rate: winners / non-null count, monospace, not colored.
 * - Avg P&L: totalR / non-null count, green/red/dimmed.
 *
 * Trades marked `missed_opportunity` are excluded from every metric — they
 * represent opportunities the user did not take and must not affect P&L or win
 * rate. The calendar grid still displays them; only these cards filter them out.
 */
export function JournalStats({ trades }: JournalStatsProps) {
  const { t } = useTranslation()
  const scored = useMemo(
    () => trades.filter((trade) => !trade.missed_opportunity),
    [trades],
  )
  const { totalTrades, totalR, winRate, avgR } = computeStats(scored)

  const winRateDisplay =
    winRate === null ? '—' : `${Math.round(winRate * 100)}%`

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }}>
      <StatCard
        label={t('journal.stats.total_trades')}
        value={String(totalTrades)}
        color={undefined}
      />
      <StatCard
        label={t('journal.stats.total_pnl')}
        value={formatR(totalR)}
        color={signedColor(totalR)}
      />
      <StatCard
        label={t('journal.stats.win_rate')}
        value={winRateDisplay}
        color={undefined}
      />
      <StatCard
        label={t('journal.stats.avg_pnl')}
        value={formatR(avgR)}
        color={signedColor(avgR)}
      />
    </SimpleGrid>
  )
}

interface StatCardProps {
  label: string
  value: string
  color: string | undefined
}

function StatCard({ label, value, color }: StatCardProps) {
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
