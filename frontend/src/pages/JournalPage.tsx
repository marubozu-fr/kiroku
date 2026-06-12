import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  IconCalendarOff,
  IconPlus,
  IconAlertTriangle,
} from '@tabler/icons-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { AccountTypeToggles } from '@/components/journal/AccountTypeToggles'
import { EventLegend } from '@/components/journal/EventLegend'
import { JournalStats } from '@/components/journal/JournalStats'
import { TradeCalendar } from '@/components/journal/TradeCalendar'
import { TradeTable } from '@/components/journal/TradeTable'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi } from '@/services/referenceData'
import { tradesApi } from '@/services/trades'
import { formatAssetLabel } from '@/utils/format'
import type { AccountType } from '@/types/trade'

type JournalView = 'calendar' | 'list'

/**
 * Main journal page.
 *
 * Fetches the selected year's trades ONCE and distributes the data to the
 * stats cards, calendar and list views — no triple-fetching.
 */
export function JournalPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // --- Year selector ---
  const years = useFetch(useCallback((signal: AbortSignal) => tradesApi.years(signal), []))
  const assets = useFetch(assetsApi.list)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [view, setView] = useState<JournalView>('calendar')
  // Account types rendered in the calendar/list. Live is always on; Demo/Test
  // are opt-in. Stats and reviews stay live-only regardless of this selection.
  const [selectedAccountTypes, setSelectedAccountTypes] = useState<Set<AccountType>>(
    () => new Set<AccountType>(['live']),
  )

  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(() => {
    const set = new Set<number>(years.data ?? [])
    set.add(currentYear)
    return Array.from(set).sort((a, b) => b - a)
  }, [years.data, currentYear])

  // Fall back to the most recent year until the user picks one.
  const effectiveYear = selectedYear ?? yearOptions[0] ?? null

  // --- Single fetch for this year's trades ---
  // We store the year in a ref so the fetcher always reads the latest value.
  // Whenever effectiveYear changes, we call reload() to bump useFetch's nonce
  // and re-run the effect with the new year value.
  const yearRef = useRef(effectiveYear)
  const tradesFetch = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        yearRef.current !== null
          ? tradesApi.list(yearRef.current, signal)
          : Promise.resolve([]),
      // Intentionally stable — year is read from the ref; reload() drives changes.
      [],
    ),
  )

  useEffect(() => {
    yearRef.current = effectiveYear
    tradesFetch.reload()
    // reload is stable; effectiveYear is the only meaningful trigger here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveYear])

  const trades = tradesFetch.data ?? []

  // --- Asset name resolver ---
  const assetName = useCallback(
    (assetId: number | null): string => {
      if (assetId === null) return '—'
      const match = (assets.data ?? []).find((asset) => asset.id === assetId)
      if (!match) return '—'
      return formatAssetLabel(match.name, match.currency)
    },
    [assets.data],
  )

  // --- Empty state (no trades for this year, not loading/erroring) ---
  const isEmpty =
    !tradesFetch.loading && tradesFetch.error === null && trades.length === 0

  return (
    <Stack gap="md">
      {/* Header row */}
      <Group justify="space-between">
        <Title order={2}>{t('journal.title')}</Title>
        <Group gap="sm">
          <Select
            aria-label={t('journal.year')}
            w={120}
            allowDeselect={false}
            data={yearOptions.map(String)}
            value={effectiveYear === null ? null : String(effectiveYear)}
            onChange={(value) => {
              if (value) setSelectedYear(Number(value))
            }}
          />
          <Button leftSection={<IconPlus size={20} />} onClick={() => navigate('/journal/new')}>
            {t('journal.add_trade')}
          </Button>
        </Group>
      </Group>

      {/* Loading skeletons */}
      {tradesFetch.loading && (
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={80} radius="md" />
            ))}
          </SimpleGrid>
          <Skeleton height={400} radius="md" />
        </Stack>
      )}

      {/* Error state */}
      {!tradesFetch.loading && tradesFetch.error !== null && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={20} />}
          title={t('journal.table.load_error')}
        >
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{tradesFetch.error}</Text>
            <Button variant="default" size="xs" onClick={tradesFetch.reload}>
              {t('common.actions.retry')}
            </Button>
          </Stack>
        </Alert>
      )}

      {/* Empty state */}
      {isEmpty && effectiveYear !== null && (
        <Card padding="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray">
              <IconCalendarOff size={32} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              {t('journal.empty.title', { year: effectiveYear })}
            </Text>
            <Text c="dimmed" size="sm" ta="center">
              {t('journal.empty.subtitle')}
            </Text>
            <Button onClick={() => navigate('/journal/new')}>
              {t('journal.empty.cta')}
            </Button>
          </Stack>
        </Card>
      )}

      {/* Main content (stats + view toggle + calendar/list) */}
      {!tradesFetch.loading && tradesFetch.error === null && !isEmpty && effectiveYear !== null && (
        <Stack gap="md">
          <Stack gap={6}>
            <JournalStats trades={trades} />
            <Group gap={6} align="center">
              <Badge variant="light" color="blue" size="sm">
                {t('journal.stats.live_only_badge')}
              </Badge>
              <Text size="xs" c="dimmed">
                {t('journal.stats.live_only_caption')}
              </Text>
            </Group>
          </Stack>

          <Group justify="space-between" align="center" gap="sm" wrap="wrap">
            <SegmentedControl
              value={view}
              onChange={(v) => setView(v as JournalView)}
              data={[
                { label: t('journal.view.calendar'), value: 'calendar' },
                { label: t('journal.view.list'), value: 'list' },
              ]}
              maw={{ base: '100%', sm: 320 }}
            />
            <AccountTypeToggles
              value={selectedAccountTypes}
              onChange={setSelectedAccountTypes}
            />
          </Group>

          {view === 'calendar' ? (
            <TradeCalendar
              trades={trades}
              assetName={assetName}
              selectedYear={effectiveYear}
              selectedAccountTypes={selectedAccountTypes}
            />
          ) : (
            <TradeTable
              trades={trades}
              loading={false}
              error={null}
              reload={tradesFetch.reload}
              assetName={assetName}
              year={effectiveYear}
              selectedAccountTypes={selectedAccountTypes}
            />
          )}

          <EventLegend />
        </Stack>
      )}
    </Stack>
  )
}
