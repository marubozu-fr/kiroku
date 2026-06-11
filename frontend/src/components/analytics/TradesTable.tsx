import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
} from '@tabler/icons-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Pagination,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { formatR, formatLocalDate, signedColor } from '@/components/journal/format'
import { formatDuration } from '@/components/analytics/format'
import { formatTimeframeGroup } from '@/components/trade-detail/format'
import { useFetch } from '@/hooks/useFetch'
import { fetchTrades } from '@/services/analytics'
import type { AnalyticsFilters, AnalyticsTradeEmotion } from '@/types/analytics'
import classes from './TradesTable.module.css'

const PER_PAGE = 20

// Severity colours — mirrors EmotionsTab's SEVERITY_COLOR map.
const SEVERITY_COLOR: Record<string, string> = {
  Good: 'green',
  Warning: 'orange',
  Bad: 'red',
}

export interface TradesTableProps {
  filters: AnalyticsFilters
}

/** Badge list with first-2 visible + "+N more" overflow tooltip. */
function BadgeList({
  items,
  renderBadge,
}: {
  items: { id: number; name: string }[]
  renderBadge: (item: { id: number; name: string }) => React.ReactNode
}) {
  if (items.length === 0) {
    return <Text c="dimmed">—</Text>
  }

  const visible = items.slice(0, 2)
  const overflow = items.slice(2)

  return (
    <Group gap={4} wrap="nowrap">
      {visible.map((item) => (
        <span key={item.id}>{renderBadge(item)}</span>
      ))}
      {overflow.length > 0 && (
        <Tooltip label={overflow.map((i) => i.name).join(', ')} withArrow>
          <Badge variant="outline" color="gray" size="sm">
            +{overflow.length}
          </Badge>
        </Tooltip>
      )}
    </Group>
  )
}

export function TradesTable({ filters }: TradesTableProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [page, setPage] = useState(1)

  // paramsRef is the single source of truth for what the next fetch should use.
  // We update it synchronously before calling reload() so the fetch callback
  // always reads the correct values, regardless of when React commits state.
  const paramsRef = useRef({ filters, page: 1 })

  // When set, the page effect will skip its next invocation.
  // Used to suppress the redundant reload triggered by setPage(1) inside the
  // filters effect (filter change already called reload with page=1).
  const skipPageEffect = useRef(false)

  // Prevents both effects from firing on the initial mount.
  // useFetch triggers its own initial fetch; we must not double-fetch.
  const filtersEffectMounted = useRef(false)
  const pageEffectMounted = useRef(false)

  const result = useFetch(
    useCallback((signal: AbortSignal) => {
      const { filters: f, page: p } = paramsRef.current
      return fetchTrades(f, p, PER_PAGE, signal)
    }, []),
  )

  // Filter change: reset page to 1 and fire ONE reload.
  useEffect(() => {
    if (!filtersEffectMounted.current) {
      filtersEffectMounted.current = true
      return
    }
    paramsRef.current = { filters, page: 1 }
    // setPage(1) will trigger a page-effect run if page was > 1.
    // Mark it so the page effect skips that extra reload.
    if (page > 1) {
      skipPageEffect.current = true
    }
    setPage(1)
    result.reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  // Page-only change: reload for the new page number.
  useEffect(() => {
    if (!pageEffectMounted.current) {
      pageEffectMounted.current = true
      return
    }
    if (skipPageEffect.current) {
      skipPageEffect.current = false
      return
    }
    paramsRef.current = { filters, page }
    result.reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const data = result.data
  const pagination = data?.pagination ?? { page: 1, per_page: PER_PAGE, total: 0, total_pages: 0 }
  const trades = data?.trades ?? []

  const from = (pagination.page - 1) * PER_PAGE + 1
  const to = Math.min(pagination.page * PER_PAGE, pagination.total)

  return (
    <Card padding="md" radius="md" withBorder>
      <Stack gap="sm">
        <div>
          <Title order={5}>{t('analytics.table.title')}</Title>
        </div>

        {result.loading && (
          <Stack gap="xs">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} height={40} radius="sm" />
            ))}
          </Stack>
        )}

        {!result.loading && result.error !== null && (
          <Alert
            color="orange"
            icon={<IconAlertTriangle size={20} />}
            title={t('analytics.table.load_error')}
          >
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{result.error}</Text>
              <Button variant="default" size="xs" onClick={result.reload}>
                {t('common.actions.retry')}
              </Button>
            </Stack>
          </Alert>
        )}

        {!result.loading && result.error === null && pagination.total === 0 && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Text fw={500}>{t('analytics.table.empty.title')}</Text>
              <Text c="dimmed" size="sm" ta="center">
                {t('analytics.table.empty.description')}
              </Text>
            </Stack>
          </Center>
        )}

        {!result.loading && result.error === null && pagination.total > 0 && (
          <>
            <Table.ScrollContainer minWidth={900}>
              <Table striped highlightOnHover fz="sm" verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th tt="uppercase" fz="xs" c="dimmed">
                      {t('analytics.table.header.date')}
                    </Table.Th>
                    <Table.Th tt="uppercase" fz="xs" c="dimmed">
                      {t('analytics.table.header.asset')}
                    </Table.Th>
                    <Table.Th tt="uppercase" fz="xs" c="dimmed" ta="center">
                      {t('analytics.table.header.direction')}
                    </Table.Th>
                    <Table.Th tt="uppercase" fz="xs" c="dimmed" ta="center">
                      {t('analytics.table.header.entry_tf')}
                    </Table.Th>
                    <Table.Th tt="uppercase" fz="xs" c="dimmed">
                      {t('analytics.table.header.tags')}
                    </Table.Th>
                    <Table.Th tt="uppercase" fz="xs" c="dimmed">
                      {t('analytics.table.header.emotions')}
                    </Table.Th>
                    <Table.Th tt="uppercase" fz="xs" c="dimmed" ta="right">
                      {t('analytics.table.header.pnl')}
                    </Table.Th>
                    <Table.Th tt="uppercase" fz="xs" c="dimmed" ta="right">
                      {t('analytics.table.header.duration')}
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {trades.map((trade) => (
                    <Table.Tr
                      key={trade.id}
                      className={`${classes.row}${trade.missed_opportunity ? ` ${classes.missed}` : ''}`}
                      onClick={() => navigate(`/journal/${trade.id}`)}
                    >
                      <Table.Td ff="monospace">
                        <Group gap="xs" wrap="nowrap">
                          {formatLocalDate(trade.trade_date)}
                          {trade.missed_opportunity && (
                            <Badge size="xs" variant="outline" color="gray">
                              {t('analytics.table.missed')}
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {trade.asset_name
                          ? trade.asset_currency
                            ? `${trade.asset_name}/${trade.asset_currency}`
                            : trade.asset_name
                          : '—'}
                      </Table.Td>
                      <Table.Td ta="center">
                        {trade.direction === 'Long' ? (
                          <Tooltip label="Long" withArrow>
                            <IconArrowUp size={16} color="var(--mantine-color-teal-6)" />
                          </Tooltip>
                        ) : trade.direction === 'Short' ? (
                          <Tooltip label="Short" withArrow>
                            <IconArrowDown size={16} color="var(--mantine-color-grape-6)" />
                          </Tooltip>
                        ) : (
                          <Text c="dimmed">—</Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="center">
                        {formatTimeframeGroup(trade.timeframe_value, trade.timeframe_unit)}
                      </Table.Td>
                      <Table.Td>
                        <BadgeList
                          items={trade.tags}
                          renderBadge={(item) => (
                            <Badge variant="outline" color="gray" size="sm">
                              {item.name}
                            </Badge>
                          )}
                        />
                      </Table.Td>
                      <Table.Td>
                        <BadgeList
                          items={trade.emotions as { id: number; name: string }[]}
                          renderBadge={(item) => {
                            const emotion = item as AnalyticsTradeEmotion
                            return (
                              <Badge
                                variant="light"
                                color={SEVERITY_COLOR[emotion.severity] ?? 'gray'}
                                size="sm"
                              >
                                {emotion.name}
                              </Badge>
                            )
                          }}
                        />
                      </Table.Td>
                      <Table.Td ff="monospace" ta="right" c={signedColor(trade.performance_r)}>
                        {formatR(trade.performance_r)}
                      </Table.Td>
                      <Table.Td ta="right">
                        {trade.duration_minutes === null
                          ? '—'
                          : formatDuration(trade.duration_minutes / 60)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            <Group justify="space-between" pt="xs">
              <Text size="sm" c="dimmed">
                {t('analytics.table.count', { from, to, total: pagination.total })}
              </Text>
              {pagination.total_pages > 1 && (
                <Pagination
                  value={page}
                  onChange={setPage}
                  total={pagination.total_pages}
                  size="sm"
                />
              )}
            </Group>
          </>
        )}
      </Stack>
    </Card>
  )
}
