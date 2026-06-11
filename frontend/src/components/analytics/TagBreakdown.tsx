import { useTranslation } from 'react-i18next'
import { BreakdownChart } from '@/components/analytics/BreakdownChart'
import type { BreakdownChartItem } from '@/components/analytics/BreakdownChart'
import type { TagBreakdown as TagBreakdownType } from '@/types/analytics'

interface TagBreakdownProps {
  data: TagBreakdownType[]
}

export function TagBreakdown({ data }: TagBreakdownProps) {
  const { t } = useTranslation()

  const items: BreakdownChartItem[] = data.map((d) => ({
    id: d.tag_id,
    label: d.tag_name,
    total_trades: d.total_trades,
    winning_trades: d.winning_trades,
    win_rate: d.win_rate,
    total_pnl: d.total_pnl,
    avg_pnl: d.avg_pnl,
    profit_factor: d.profit_factor,
  }))

  return (
    <BreakdownChart
      title={t('analytics.breakdown.tags.title')}
      items={items}
      emptyMessage={t('analytics.breakdown.tags.empty')}
    />
  )
}
