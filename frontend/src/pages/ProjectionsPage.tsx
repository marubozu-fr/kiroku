import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAlertTriangle } from '@tabler/icons-react'
import {
  Alert,
  Button,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { ProjectionChart } from '@/components/projections/ProjectionChart'
import { ProjectionEmptyState } from '@/components/projections/ProjectionEmptyState'
import { ProjectionFilters } from '@/components/projections/ProjectionFilters'
import { ProjectionMethodology } from '@/components/projections/ProjectionMethodology'
import { ProjectionStats } from '@/components/projections/ProjectionStats'
import { useFetch } from '@/hooks/useFetch'
import { fetchProjections } from '@/services/projections'
import type { ProjectionFilters as ProjectionFiltersType, Projections } from '@/types/projections'

/**
 * Projections page (route `/projections`).
 *
 * Fetches Monte Carlo simulation data from GET /api/projections and composes
 * the fan chart, stats row, filters panel, and methodology accordion.
 */
export function ProjectionsPage() {
  const { t } = useTranslation()

  const [filters, setFilters] = useState<ProjectionFiltersType>({})
  const [debouncedFilters] = useDebouncedValue(filters, 300)

  // Keep a ref so the stable useFetch callback always reads the latest filters
  const filtersRef = useRef<ProjectionFiltersType>(debouncedFilters)

  const result = useFetch<Projections>(
    useCallback(
      (signal: AbortSignal) => fetchProjections(filtersRef.current, signal),
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
  const isEmpty = settled && data.stats.total_trades === 0
  const hasData = settled && data.stats.total_trades > 0

  function countActiveFilters(f: ProjectionFiltersType): number {
    let count = 0
    if (f.start_date) count++
    if (f.assets && f.assets.length > 0) count++
    if (f.goal_r !== undefined) count++
    return count
  }

  return (
    <Stack gap="md">
      {/* Page header */}
      <Stack gap={2}>
        <Title order={2}>{t('projections.title')}</Title>
        <Text c="dimmed">{t('projections.subtitle')}</Text>
      </Stack>

      {/* Filters — shown once initial data has settled or during reload */}
      {(data !== null || result.loading) && !isEmpty && (
        <ProjectionFilters
          filters={filters}
          onChange={setFilters}
          activeFilterCount={countActiveFilters(filters)}
        />
      )}

      {/* Loading skeletons */}
      {result.loading && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={90} radius="md" />
            ))}
          </SimpleGrid>
          <Skeleton height={360} radius="md" />
        </>
      )}

      {/* Error state */}
      {!result.loading && result.error !== null && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={20} />}
          title={t('projections.load_error')}
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
      {isEmpty && <ProjectionEmptyState />}

      {/* Stats + chart + methodology */}
      {hasData && (
        <>
          <ProjectionStats
            stats={data.stats}
            goal={data.goal}
            risk={data.risk}
          />
          <ProjectionChart
            actualMonths={data.actual_months}
            projectedMonths={data.projected_months}
            goal={data.goal}
          />
          <ProjectionMethodology />
        </>
      )}
    </Stack>
  )
}
