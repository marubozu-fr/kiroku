import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { IconAlertTriangle } from '@tabler/icons-react'
import { Alert, Badge, Button, Center, Skeleton, Stack, Table, Text } from '@mantine/core'
import type { TradeSummary } from '@/types/trade'
import {
  DIRECTION_COLOR,
  STATUS_COLOR,
  formatLocalDate,
  formatPnl,
  signedColor,
} from './format'
import classes from './TradeTable.module.css'

interface TradeTableProps {
  /** Trades to render. Provided by the parent page (no fetch here). */
  trades: TradeSummary[]
  /** Whether the data is currently loading (shows skeletons). */
  loading: boolean
  /** Error message, if any. */
  error: string | null
  /** Callback to retry the failed fetch. */
  reload: () => void
  /** Resolves an `asset_id` to its display name. */
  assetName: (assetId: number | null) => string
  /** The selected year, used in the empty-state message. */
  year: number
}

/**
 * Trade journal table. Purely presentational — data is provided via props.
 *
 * Only `live` trades are listed for now. Demo and test trades are excluded to
 * stay consistent with the stats cards and calendar reviews; the follow-up
 * enhancement will add account-type toggles with distinct styling.
 *
 * Click a row to open the trade detail page.
 */
export function TradeTable({ trades, loading, error, reload, assetName, year }: TradeTableProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const liveTrades = useMemo(
    () => trades.filter((trade) => trade.account_type === 'live'),
    [trades],
  )

  if (loading) {
    return (
      <Stack gap="xs">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} height={40} radius="sm" />
        ))}
      </Stack>
    )
  }

  if (error) {
    return (
      <Alert
        color="orange"
        icon={<IconAlertTriangle size={20} />}
        title={t('journal.table.load_error')}
      >
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{error}</Text>
          <Button variant="default" size="xs" onClick={reload}>
            {t('common.actions.retry')}
          </Button>
        </Stack>
      </Alert>
    )
  }

  if (liveTrades.length === 0) {
    return (
      <Center mih={160}>
        <Text c="dimmed" size="sm" ta="center">
          {t('journal.table.empty', { year })}
        </Text>
      </Center>
    )
  }

  return (
    <Table.ScrollContainer minWidth={720}>
      <Table striped highlightOnHover fz="sm" verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th tt="uppercase" fz="xs" c="dimmed">
              {t('journal.table.header.date')}
            </Table.Th>
            <Table.Th tt="uppercase" fz="xs" c="dimmed">
              {t('journal.table.header.asset')}
            </Table.Th>
            <Table.Th tt="uppercase" fz="xs" c="dimmed">
              {t('journal.table.header.direction')}
            </Table.Th>
            <Table.Th tt="uppercase" fz="xs" c="dimmed">
              {t('journal.table.header.status')}
            </Table.Th>
            <Table.Th tt="uppercase" fz="xs" c="dimmed" ta="right">
              {t('journal.table.header.pnl')}
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {liveTrades.map((trade) => (
            <Table.Tr
              key={trade.id}
              className={classes.row}
              onClick={() => navigate(`/journal/${trade.id}`)}
            >
              <Table.Td ff="monospace">{formatLocalDate(trade.trade_date)}</Table.Td>
              <Table.Td>{assetName(trade.asset_id)}</Table.Td>
              <Table.Td>
                {trade.direction ? (
                  <Badge
                    variant="light"
                    color={DIRECTION_COLOR[trade.direction]}
                  >
                    {trade.direction}
                  </Badge>
                ) : (
                  <Text c="dimmed">—</Text>
                )}
              </Table.Td>
              <Table.Td>
                <Badge variant="light" color={STATUS_COLOR[trade.status]}>
                  {trade.status}
                </Badge>
              </Table.Td>
              <Table.Td ff="monospace" ta="right" c={signedColor(trade.performance_r)}>
                {formatPnl(trade.performance_r, trade.risk_per_trade)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
