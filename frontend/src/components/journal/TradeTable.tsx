import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { IconAlertTriangle } from '@tabler/icons-react'
import { Alert, Badge, Button, Center, Skeleton, Stack, Table, Text } from '@mantine/core'
import type { AccountType, TradeSummary } from '@/types/trade'
import {
  ACCOUNT_COLOR,
  DIRECTION_COLOR,
  STATUS_COLOR,
  accountSignedColor,
  formatLocalDate,
  formatPnl,
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
  /** Account types whose trades are rendered in the table. */
  selectedAccountTypes: Set<AccountType>
}

/** Returns the muted-row CSS class for a non-live trade, or '' for live. */
function rowClass(accountType: AccountType): string {
  if (accountType === 'demo') return classes.rowDemo
  if (accountType === 'test') return classes.rowTest
  return ''
}

/**
 * Trade journal table. Purely presentational — data is provided via props.
 *
 * Live trades are always listed; demo/test trades appear only when their type
 * is toggled on via `selectedAccountTypes`, rendered with a muted row and an
 * account badge so they read as "doesn't count". Stats/reviews stay live-only.
 *
 * Click a row to open the trade detail page.
 */
export function TradeTable({
  trades,
  loading,
  error,
  reload,
  assetName,
  year,
  selectedAccountTypes,
}: TradeTableProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const visibleTrades = useMemo(
    () => trades.filter((trade) => selectedAccountTypes.has(trade.account_type)),
    [trades, selectedAccountTypes],
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

  if (visibleTrades.length === 0) {
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
              {t('journal.list.header.account')}
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
          {visibleTrades.map((trade) => (
            <Table.Tr
              key={trade.id}
              className={`${classes.row} ${rowClass(trade.account_type)}`.trim()}
              onClick={() => navigate(`/journal/${trade.id}`)}
            >
              <Table.Td ff="monospace">{formatLocalDate(trade.trade_date)}</Table.Td>
              <Table.Td>
                <Badge variant="light" color={ACCOUNT_COLOR[trade.account_type]}>
                  {t(`journal.account_type.${trade.account_type}`)}
                </Badge>
              </Table.Td>
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
              <Table.Td
                ff="monospace"
                ta="right"
                c={accountSignedColor(trade.performance_r, trade.account_type)}
              >
                {formatPnl(trade.performance_r, trade.risk_per_trade)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
