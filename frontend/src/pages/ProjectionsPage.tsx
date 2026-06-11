import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAlertTriangle } from '@tabler/icons-react'
import {
  Alert,
  Button,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { GoalProbabilityCard } from '@/components/projections/GoalProbabilityCard'
import { ProjectionChart } from '@/components/projections/ProjectionChart'
import { ProjectionComparison } from '@/components/projections/ProjectionComparison'
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
 *
 * Main fetch always runs without the `assets` filter (represents "All assets").
 * When assets are selected a second fetch runs with the full filters; its fan
 * is re-anchored to the main fan's "now" point via an offset so both fans
 * originate at the same cumulative R.
 */
export function ProjectionsPage() {
  const { t } = useTranslation()

  const [filters, setFilters] = useState<ProjectionFiltersType>({})
  const [debouncedFilters] = useDebouncedValue(filters, 300)

  // Whether the comparison overlay is currently shown (default on)
  const [showComparison, setShowComparison] = useState(true)

  // ---------------------------------------------------------------------------
  // Main fetch — always excludes `assets` filter (represents "All assets")
  // ---------------------------------------------------------------------------
  const mainFiltersRef = useRef<Omit<ProjectionFiltersType, 'assets'>>(
    { start_date: debouncedFilters.start_date, goal_r: debouncedFilters.goal_r },
  )

  const mainResult = useFetch<Projections>(
    useCallback(
      (signal: AbortSignal) => fetchProjections(mainFiltersRef.current, signal),
      [],
    ),
  )

  useEffect(() => {
    mainFiltersRef.current = {
      start_date: debouncedFilters.start_date,
      goal_r: debouncedFilters.goal_r,
    }
    mainResult.reload()
    // reload is stable; debouncedFilters is the only meaningful trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilters])

  // ---------------------------------------------------------------------------
  // Comparison fetch — only when assets are selected
  // The same ref+reload pattern as the main fetch (mirrors useFetch internals)
  // to ensure no setState is called synchronously inside a useEffect body.
  // ---------------------------------------------------------------------------
  const hasAssets = (debouncedFilters.assets?.length ?? 0) > 0

  const compFiltersRef = useRef<ProjectionFiltersType>(debouncedFilters)

  const compResult = useFetch<Projections>(
    useCallback(
      (signal: AbortSignal) => {
        // When no assets are selected, return a never-resolving promise so
        // useFetch stays "loading" but never commits stale data. The compResult
        // is gated on `hasAssets` in the render, so it is never displayed.
        if (!compFiltersRef.current.assets?.length) {
          return new Promise<Projections>(() => {})
        }
        return fetchProjections(compFiltersRef.current, signal)
      },
      [],
    ),
  )

  useEffect(() => {
    compFiltersRef.current = debouncedFilters
    if (hasAssets) {
      compResult.reload()
    }
    // reload is stable; debouncedFilters / hasAssets are the only triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilters])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const data = mainResult.data
  const settled = !mainResult.loading && mainResult.error === null && data !== null
  const isEmpty = settled && data.stats.total_trades === 0
  const hasData = settled && data.stats.total_trades > 0

  // Compute offset: mainLastActual - compLastActual so both fans start at the
  // same "now" point (TraderPro re-anchoring concept).
  const mainLastActual =
    data && data.actual_months.length > 0
      ? data.actual_months[data.actual_months.length - 1].cumulative_r
      : 0

  const compData = hasAssets ? compResult.data : null
  const compLoading = hasAssets ? compResult.loading : false
  const compError = hasAssets ? compResult.error : null

  const compLastActual =
    compData && compData.actual_months.length > 0
      ? compData.actual_months[compData.actual_months.length - 1].cumulative_r
      : 0

  const compOffset = mainLastActual - compLastActual

  const assetLabel = debouncedFilters.assets?.join(', ') ?? ''

  const mainYearEndR = data?.projected_months.at(-1)?.p50 ?? mainLastActual
  const compYearEndR = (compData?.projected_months.at(-1)?.p50 ?? compLastActual) + compOffset

  const comparisonFan =
    hasData && compData && showComparison
      ? {
          projectedMonths: compData.projected_months,
          offset: compOffset,
          label: assetLabel,
        }
      : undefined

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
      {(data !== null || mainResult.loading) && !isEmpty && (
        <ProjectionFilters
          filters={filters}
          onChange={setFilters}
          activeFilterCount={countActiveFilters(filters)}
        />
      )}

      {/* Comparison toggle — only visible when assets are selected */}
      {hasData && hasAssets && (
        <Switch
          label={t('projections.comparison.toggle')}
          checked={showComparison}
          onChange={(e) => setShowComparison(e.currentTarget.checked)}
          size="sm"
        />
      )}

      {/* Loading skeletons */}
      {mainResult.loading && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={90} radius="md" />
            ))}
          </SimpleGrid>
          <Skeleton height={360} radius="md" />
        </>
      )}

      {/* Error state */}
      {!mainResult.loading && mainResult.error !== null && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={20} />}
          title={t('projections.load_error')}
        >
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{mainResult.error}</Text>
            <Button variant="default" size="xs" onClick={mainResult.reload}>
              {t('common.actions.retry')}
            </Button>
          </Stack>
        </Alert>
      )}

      {/* Empty state */}
      {isEmpty && <ProjectionEmptyState />}

      {/* Stats + goal card + chart + comparison + methodology */}
      {hasData && (
        <>
          <ProjectionStats
            stats={data.stats}
            risk={data.risk}
          />

          {/* Prominent goal probability card — full-width, above the chart */}
          {data.goal && <GoalProbabilityCard goal={data.goal} />}

          <ProjectionChart
            actualMonths={data.actual_months}
            projectedMonths={data.projected_months}
            goal={data.goal}
            comparison={comparisonFan}
          />

          {/* Comparison loading/error feedback */}
          {hasAssets && compLoading && (
            <Skeleton height={120} radius="md" />
          )}
          {hasAssets && !compLoading && compError !== null && (
            <Alert color="orange" icon={<IconAlertTriangle size={20} />}>
              <Text size="sm">{compError}</Text>
            </Alert>
          )}

          {/* Side-by-side comparison stats */}
          {hasAssets && showComparison && compData && !compLoading && compError === null && (
            <ProjectionComparison
              mainStats={data.stats}
              compStats={compData.stats}
              mainYearEndR={mainYearEndR}
              compYearEndR={compYearEndR}
              assetLabel={assetLabel}
            />
          )}

          <ProjectionMethodology />
        </>
      )}
    </Stack>
  )
}
