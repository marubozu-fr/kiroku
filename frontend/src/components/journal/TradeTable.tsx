import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconAlertTriangle } from '@tabler/icons-react'
import { Alert, Badge, Button, Center, Skeleton, Stack, Table, Text } from '@mantine/core'
import { useFetch } from '@/hooks/useFetch'
import { tradesApi } from '@/services/trades'
import {
  STATUS_COLOR,
  formatDate,
  formatPnl,
  formatR,
  signedColor,
} from './format'
import classes from './TradeTable.module.css'

interface TradeTableProps {
  /** Calendar year to load trades for. */
  year: number
  /** Resolves an `asset_id` to its display name. */
  assetName: (assetId: number | null) => string
}

/**
 * Trade journal table for a single year. Owns its data fetch so it can be
 * remounted (via `key={year}`) to reload when the selected year changes.
 *
 * Click a row to open the trade detail page.
 */
export function TradeTable({ year, assetName }: TradeTableProps) {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch(
    useCallback((signal: AbortSignal) => tradesApi.list(year, signal), [year]),
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
        title="Could not load trades"
      >
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{error}</Text>
          <Button variant="default" size="xs" onClick={reload}>
            Retry
          </Button>
        </Stack>
      </Alert>
    )
  }

  const trades = data ?? []

  if (trades.length === 0) {
    return (
      <Center mih={160}>
        <Text c="dimmed" size="sm" ta="center">
          No trades for {year}. Add one to start filling your journal.
        </Text>
      </Center>
    )
  }

  return (
    <Table.ScrollContainer minWidth={720}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th tt="uppercase" fz="xs" c="dimmed">
              Date
            </Table.Th>
            <Table.Th tt="uppercase" fz="xs" c="dimmed">
              Asset
            </Table.Th>
            <Table.Th tt="uppercase" fz="xs" c="dimmed">
              Direction
            </Table.Th>
            <Table.Th tt="uppercase" fz="xs" c="dimmed">
              Status
            </Table.Th>
            <Table.Th tt="uppercase" fz="xs" c="dimmed" ta="right">
              P&amp;L
            </Table.Th>
            <Table.Th tt="uppercase" fz="xs" c="dimmed" ta="right">
              R
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
              <Table.Td ff="monospace">{formatDate(trade.trade_date)}</Table.Td>
              <Table.Td>{assetName(trade.asset_id)}</Table.Td>
              <Table.Td>
                {trade.direction ? (
                  <Badge
                    variant="light"
                    color={trade.direction === 'Long' ? 'blue' : 'grape'}
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
              <Table.Td ff="monospace" ta="right" c={signedColor(trade.realized_pnl)}>
                {formatPnl(trade.realized_pnl)}
              </Table.Td>
              <Table.Td ff="monospace" ta="right" c={signedColor(trade.performance_r)}>
                {formatR(trade.performance_r)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
