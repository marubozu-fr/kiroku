import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Anchor, Badge, Stack, Table, Text, Title } from '@mantine/core'
import type { RecentTradeItem } from '@/types/dashboard'
import type { DisplayMode } from './KpiCards'
import {
  DIRECTION_COLOR,
  formatLocalDate,
  formatPercent,
  formatR,
  signedColor,
} from '@/components/journal/format'
import { formatAssetLabel } from '@/utils/format'
import classes from './RecentActivity.module.css'

interface RecentActivityProps {
  trades: RecentTradeItem[]
  displayMode: DisplayMode
}

/** Format P&L according to display mode, handling nulls. */
function formatPnlValue(
  performanceR: number | null,
  performancePct: number | null,
  displayMode: DisplayMode,
): string {
  if (displayMode === 'r') {
    return formatR(performanceR)
  }
  if (performancePct === null) return '—'
  return formatPercent(performancePct)
}

/**
 * Recent Activity table for the dashboard.
 *
 * Shows the most recent trades with asset, direction, date and P&L.
 * Clicking a row navigates to the trade detail page.
 */
export function RecentActivity({ trades, displayMode }: RecentActivityProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Stack gap="xs">
      <Title order={4}>{t('dashboard.activity.title')}</Title>

      {trades.length === 0 ? (
        <Text c="dimmed" fz="sm">
          {t('dashboard.activity.empty')}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={480}>
          <Table striped highlightOnHover fz="sm" verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('dashboard.activity.header.asset')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('dashboard.activity.header.direction')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('dashboard.activity.header.date')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed" ta="right">
                  {t('dashboard.activity.header.pnl')}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {trades.map((trade) => (
                <Table.Tr
                  key={trade.id}
                  className={classes.row}
                  onClick={() => navigate(`/journal/${trade.id}`)}
                >
                  <Table.Td>{formatAssetLabel(trade.asset_name, trade.asset_currency)}</Table.Td>
                  <Table.Td>
                    {trade.direction !== null && trade.direction in DIRECTION_COLOR ? (
                      <Badge
                        variant="light"
                        color={DIRECTION_COLOR[trade.direction as keyof typeof DIRECTION_COLOR]}
                      >
                        {trade.direction}
                      </Badge>
                    ) : (
                      <Text c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td fz="sm" c="dimmed">
                    {formatLocalDate(trade.trade_date)}
                  </Table.Td>
                  <Table.Td
                    ff="monospace"
                    ta="right"
                    c={signedColor(
                      displayMode === 'r' ? trade.performance_r : trade.performance_pct,
                    )}
                  >
                    {formatPnlValue(trade.performance_r, trade.performance_pct, displayMode)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Anchor component={Link} to="/journal" fz="sm" ta="right" c="dimmed">
        {t('dashboard.activity.view_all')}
      </Anchor>
    </Stack>
  )
}
