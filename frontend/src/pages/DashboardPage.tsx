import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAlertTriangle } from '@tabler/icons-react'
import {
  Alert,
  Button,
  Group,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import { KpiCards, type DisplayMode } from '@/components/dashboard/KpiCards'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { useFetch } from '@/hooks/useFetch'
import { fetchDashboard } from '@/services/dashboardService'

type DashboardPeriod = 'ytd' | '1y' | '5y' | 'all'

const PERIOD_KEY = 'kiroku_dashboard_period'
const DISPLAY_MODE_KEY = 'kiroku_dashboard_display_mode'
const PERIODS: readonly DashboardPeriod[] = ['ytd', '1y', '5y', 'all']
const DISPLAY_MODES: readonly DisplayMode[] = ['r', 'pct']

/** Read a persisted preference, falling back when missing or invalid. */
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const stored = localStorage.getItem(key)
  return stored !== null && (allowed as readonly string[]).includes(stored)
    ? (stored as T)
    : fallback
}

/**
 * Dashboard home page (route `/`).
 *
 * Fetches `GET /api/dashboard` for the selected period and renders the KPI
 * cards. The period and R/% display-mode preferences persist in localStorage.
 * Charts and recent activity are delivered by separate issues.
 */
export function DashboardPage() {
  const { t } = useTranslation()

  const [period, setPeriod] = useState<DashboardPeriod>(() =>
    readStored(PERIOD_KEY, PERIODS, 'ytd'),
  )
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() =>
    readStored(DISPLAY_MODE_KEY, DISPLAY_MODES, 'r'),
  )

  // Persist preferences whenever they change.
  useEffect(() => {
    localStorage.setItem(PERIOD_KEY, period)
  }, [period])
  useEffect(() => {
    localStorage.setItem(DISPLAY_MODE_KEY, displayMode)
  }, [displayMode])

  // Re-fetch when the period changes. The fetcher reads `period` from a ref so
  // it stays stable; bumping reload() re-runs the effect (same pattern as the
  // journal page).
  const periodRef = useRef(period)
  const dashboard = useFetch(
    useCallback((signal: AbortSignal) => fetchDashboard(periodRef.current, 'all', signal), []),
  )

  useEffect(() => {
    periodRef.current = period
    dashboard.reload()
    // reload is stable; period is the only meaningful trigger here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const data = dashboard.data
  const settled = !dashboard.loading && dashboard.error === null && data !== null
  const isEmpty = settled && data.stats.total_trades === 0
  const hasData = settled && data.stats.total_trades > 0

  return (
    <Stack gap="md">
      {/* Header: title + display-mode and period controls */}
      <Group justify="space-between">
        <Title order={2}>{t('dashboard.title')}</Title>
        <Group gap="sm">
          <SegmentedControl
            aria-label={t('dashboard.controls.display_mode')}
            value={displayMode}
            onChange={(value) => setDisplayMode(value as DisplayMode)}
            disabled={isEmpty}
            data={[
              { label: 'R', value: 'r' },
              { label: '%', value: 'pct' },
            ]}
          />
          <SegmentedControl
            aria-label={t('dashboard.controls.period')}
            value={period}
            onChange={(value) => setPeriod(value as DashboardPeriod)}
            disabled={isEmpty}
            data={[
              { label: t('dashboard.controls.period_ytd'), value: 'ytd' },
              { label: t('dashboard.controls.period_1y'), value: '1y' },
              { label: t('dashboard.controls.period_5y'), value: '5y' },
              { label: t('dashboard.controls.period_all'), value: 'all' },
            ]}
          />
        </Group>
      </Group>

      {/* Loading skeletons (KPI row) */}
      {dashboard.loading && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={90} radius="md" />
          ))}
        </SimpleGrid>
      )}

      {/* Error state */}
      {!dashboard.loading && dashboard.error !== null && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={20} />}
          title={t('dashboard.load_error')}
        >
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{dashboard.error}</Text>
            <Button variant="default" size="xs" onClick={dashboard.reload}>
              {t('common.actions.retry')}
            </Button>
          </Stack>
        </Alert>
      )}

      {/* Empty state */}
      {isEmpty && <DashboardEmptyState />}

      {/* KPI cards */}
      {hasData && <KpiCards stats={data.stats} displayMode={displayMode} />}

      {/* Charts */}
      {hasData && (
        <DashboardCharts
          monthly={data.monthly}
          equity={data.equity}
          displayMode={displayMode}
        />
      )}

      {/* Recent Activity */}
      {hasData && (
        <RecentActivity trades={data.recent_trades} displayMode={displayMode} />
      )}
    </Stack>
  )
}
