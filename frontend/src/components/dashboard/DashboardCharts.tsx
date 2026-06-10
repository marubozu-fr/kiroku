import { useTranslation } from 'react-i18next'
import { IconChartBar, IconChartLine } from '@tabler/icons-react'
import { Card, Tabs, Text } from '@mantine/core'
import type { MonthlyDataPoint, EquityDataPoint } from '@/types/dashboard'
import type { DisplayMode } from '@/components/dashboard/KpiCards'
import { EquityCurveChart } from './EquityCurveChart'
import { MonthByMonthChart } from './MonthByMonthChart'

interface DashboardChartsProps {
  monthly: MonthlyDataPoint[]
  equity: EquityDataPoint[]
  displayMode: DisplayMode
}

export function DashboardCharts({ monthly, equity, displayMode }: DashboardChartsProps) {
  const { t } = useTranslation()

  return (
    <Card padding="md" radius="md" withBorder>
      <Text size="sm" c="dimmed" mb="sm">
        {t('dashboard.charts.title')}
      </Text>
      <Tabs defaultValue="month" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab
            value="month"
            leftSection={<IconChartBar size={16} />}
          >
            {t('dashboard.charts.tab_month')}
          </Tabs.Tab>
          <Tabs.Tab
            value="equity"
            leftSection={<IconChartLine size={16} />}
          >
            {t('dashboard.charts.tab_equity')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="month" pt="md">
          <MonthByMonthChart data={monthly} displayMode={displayMode} />
        </Tabs.Panel>

        <Tabs.Panel value="equity" pt="md">
          <EquityCurveChart data={equity} displayMode={displayMode} />
        </Tabs.Panel>
      </Tabs>
    </Card>
  )
}
