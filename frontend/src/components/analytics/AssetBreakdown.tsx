import { useTranslation } from 'react-i18next'
import { BreakdownChart } from '@/components/analytics/BreakdownChart'
import type { BreakdownChartItem } from '@/components/analytics/BreakdownChart'
import type { AssetBreakdown as AssetBreakdownType } from '@/types/analytics'

interface AssetBreakdownProps {
  data: AssetBreakdownType[]
}

export function AssetBreakdown({ data }: AssetBreakdownProps) {
  const { t } = useTranslation()

  const items: BreakdownChartItem[] = data.map((d) => ({
    id: d.asset_id,
    label: d.asset_name,
    total_trades: d.total_trades,
    winning_trades: d.winning_trades,
    win_rate: d.win_rate,
    total_pnl: d.total_pnl,
    avg_pnl: d.avg_pnl,
    profit_factor: d.profit_factor,
  }))

  return (
    <BreakdownChart
      title={t('analytics.breakdown.assets.title')}
      items={items}
      emptyMessage={t('analytics.breakdown.assets.empty')}
    />
  )
}
