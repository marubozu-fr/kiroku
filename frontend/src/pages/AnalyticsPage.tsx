import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAlertTriangle, IconChartHistogram } from '@tabler/icons-react'
import {
  Alert,
  Button,
  Card,
  Center,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { FilterPanel } from '@/components/analytics/FilterPanel'
import { StatisticsCards } from '@/components/analytics/StatisticsCards'
import { useFetch } from '@/hooks/useFetch'
import { useAnalyticsFilters } from '@/hooks/useAnalyticsFilters'
import { fetchBreakdowns, fetchStatistics, fetchTrades } from '@/services/analytics'
import type {
  AnalyticsBreakdownsResponse,
  AnalyticsFilters,
  AnalyticsStatisticsResponse,
  AnalyticsTradesResponse,
} from '@/types/analytics'

interface AllAnalyticsData {
  statistics: AnalyticsStatisticsResponse
  breakdowns: AnalyticsBreakdownsResponse
  trades: AnalyticsTradesResponse
}

/**
 * Analytics page (route `/analytics`).
 *
 * Fetches statistics, breakdowns, and the first page of trades in parallel.
 * The charts and trades table are delivered by future issues —
 * they are rendered as labelled placeholder slots.
 */
export function AnalyticsPage() {
  const { t } = useTranslation()

  const { filters, debouncedFilters, setFilter, resetFilters, activeFilterCount } =
    useAnalyticsFilters()

  // Re-fetch when debouncedFilters change via the same ref+reload pattern as DashboardPage.
  const filtersRef = useRef<AnalyticsFilters>(debouncedFilters)

  const result = useFetch<AllAnalyticsData>(
    useCallback(
      (signal: AbortSignal) =>
        Promise.all([
          fetchStatistics(filtersRef.current, signal),
          fetchBreakdowns(filtersRef.current, signal),
          fetchTrades(filtersRef.current, 1, 20, signal),
        ]).then(([statistics, breakdowns, trades]) => ({ statistics, breakdowns, trades })),
      [],
    ),
  )

  useEffect(() => {
    filtersRef.current = debouncedFilters
    result.reload()
    // reload is stable; debouncedFilters is the only meaningful trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilters])

  const data = result.data
  const settled = !result.loading && result.error === null && data !== null
  const isEmpty = settled && data.statistics.statistics.total_trades === 0
  const hasData = settled && data.statistics.statistics.total_trades > 0

  return (
    <Stack gap="md">
      {/* Page header */}
      <Stack gap={2}>
        <Title order={2}>{t('analytics.title')}</Title>
        <Text c="dimmed">{t('analytics.subtitle')}</Text>
      </Stack>

      {/* Filter panel — shown once data has loaded so available_filters is populated */}
      {data !== null ? (
        <FilterPanel
          availableFilters={data.statistics.available_filters}
          filters={filters}
          setFilter={setFilter}
          resetFilters={resetFilters}
          activeFilterCount={activeFilterCount}
        />
      ) : null}

      {/* Loading skeletons */}
      {result.loading && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={90} radius="md" />
            ))}
          </SimpleGrid>
          <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} height={90} radius="md" />
            ))}
          </SimpleGrid>
        </>
      )}

      {/* Error state */}
      {!result.loading && result.error !== null && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={20} />}
          title={t('analytics.load_error')}
        >
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{result.error}</Text>
            <Button variant="default" size="xs" onClick={result.reload}>
              {t('common.actions.retry')}
            </Button>
          </Stack>
        </Alert>
      )}

      {/* Empty state */}
      {isEmpty && (
        <Center py="xl">
          <Card padding="xl" radius="md" withBorder style={{ maxWidth: 400, width: '100%' }}>
            <Stack align="center" gap="sm">
              <IconChartHistogram size={48} stroke={1.2} />
              <Title order={4}>{t('analytics.empty.title')}</Title>
              <Text c="dimmed" ta="center" size="sm">
                {t('analytics.empty.description')}
              </Text>
            </Stack>
          </Card>
        </Center>
      )}

      {/* KPI cards */}
      {hasData && <StatisticsCards statistics={data.statistics.statistics} />}

      {/* Charts placeholder */}
      {hasData && (
        <Card padding="md" radius="md" withBorder>
          <Text c="dimmed" size="sm">
            {t('analytics.placeholder.charts')}
          </Text>
        </Card>
      )}

      {/* Trades table placeholder */}
      {hasData && (
        <Card padding="md" radius="md" withBorder>
          <Text c="dimmed" size="sm">
            {t('analytics.placeholder.trades')}
          </Text>
        </Card>
      )}
    </Stack>
  )
}
