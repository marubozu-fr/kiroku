import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconLogin,
  IconLogout,
  IconPencil,
  IconTrash,
  IconZoomIn,
} from '@tabler/icons-react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Image,
  Modal,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Timeline,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { formatTradeDuration, formatTimeframeGroup } from '@/components/trade-detail/format'
import {
  DIRECTION_COLOR,
  STATUS_COLOR,
  formatLocalDate,
  formatPnl,
  signedColor,
} from '@/components/journal/format'
import { notifyError, notifySuccess } from '@/components/settings/notify'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi } from '@/services/referenceData'
import { tradesApi } from '@/services/trades'
import { formatAssetLabel } from '@/utils/format'
import { CATEGORY_I18N_KEYS, EMOTION_CATEGORIES } from '@/types/referenceData'
import type { EmotionSeverity } from '@/types/referenceData'
import type { AccountType, TradeScreenshot } from '@/types/trade'
import classes from './TradeDetailPage.module.css'

// Severity colours per docs/DESIGN_SYSTEM.md — not re-exported from EmotionsTab.
const SEVERITY_COLOR: Record<EmotionSeverity, string> = {
  Good: 'green',
  Warning: 'orange',
  Bad: 'red',
}

// Account-type badge colours — non-semantic, never green/red.
const ACCOUNT_TYPE_COLOR: Record<AccountType, string> = {
  live: 'blue',
  demo: 'cyan',
  test: 'gray',
}

/**
 * Read-only detail view for a single trade.
 * Route: /journal/:id
 */
export function TradeDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tradeId = Number(id)

  const tradeFetch = useFetch(
    useCallback((signal: AbortSignal) => tradesApi.get(tradeId, signal), [tradeId]),
  )
  const assetsFetch = useFetch(assetsApi.list)

  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [deletePending, setDeletePending] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // All hooks must run unconditionally before any early returns.
  const assetName = useMemo(() => {
    const assetId = tradeFetch.data?.asset_id ?? null
    if (assetId === null) return '—'
    const match = (assetsFetch.data ?? []).find((a) => a.id === assetId)
    if (!match) return '—'
    return formatAssetLabel(match.name, match.currency)
  }, [tradeFetch.data, assetsFetch.data])

  const screenshotGroups = useMemo(() => {
    const map = new Map<string, TradeScreenshot[]>()
    for (const shot of tradeFetch.data?.screenshots ?? []) {
      const key = formatTimeframeGroup(shot.timeframe_value, shot.timeframe_unit)
      const existing = map.get(key) ?? []
      existing.push(shot)
      map.set(key, existing)
    }
    return map
  }, [tradeFetch.data?.screenshots])

  // Flat, display-ordered list backing the lightbox prev/next navigation.
  const orderedScreenshots = useMemo(
    () => Array.from(screenshotGroups.values()).flat(),
    [screenshotGroups],
  )

  const handleDelete = async () => {
    setDeletePending(true)
    try {
      await tradesApi.remove(tradeId)
      notifySuccess(t('trade.detail.notify.deleted'))
      navigate('/journal')
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : t('trade.detail.notify.delete_error'))
    } finally {
      setDeletePending(false)
      closeDelete()
    }
  }

  const backLink = (
    <Anchor component={Link} to="/journal" size="sm" c="dimmed">
      <Group gap="xs">
        <IconArrowLeft size={16} />
        {t('trade.back_to_journal')}
      </Group>
    </Anchor>
  )

  // --- Loading state ---
  if (tradeFetch.loading) {
    return (
      <Stack gap="md">
        <Skeleton height={32} w={200} radius="sm" />
        <Skeleton height={80} radius="sm" />
        <Skeleton height={120} radius="sm" />
        <Skeleton height={180} radius="sm" />
        <Skeleton height={100} radius="sm" />
      </Stack>
    )
  }

  // --- Error state ---
  if (tradeFetch.error) {
    const isNotFound =
      tradeFetch.error.toLowerCase().includes('404') ||
      tradeFetch.error.toLowerCase().includes('not found')

    if (isNotFound) {
      return (
        <Stack gap="md" align="flex-start">
          {backLink}
          <Alert color="orange" icon={<IconAlertTriangle size={20} />} title={t('trade.not_found_title')}>
            {t('trade.not_found_body')}{' '}
            <Anchor component={Link} to="/journal">
              {t('trade.return_to_journal')}
            </Anchor>
          </Alert>
        </Stack>
      )
    }

    return (
      <Stack gap="md" align="flex-start">
        {backLink}
        <Alert color="orange" icon={<IconAlertTriangle size={20} />} title={t('trade.load_error')}>
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{tradeFetch.error}</Text>
            <Button variant="default" size="xs" onClick={tradeFetch.reload}>
              {t('common.actions.retry')}
            </Button>
          </Stack>
        </Alert>
      </Stack>
    )
  }

  const trade = tradeFetch.data
  if (!trade) {
    return null
  }

  // --- Derived values (no hooks below this point) ---
  const sortedActivities = [...trade.activities].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const entries = sortedActivities.filter((a) => a.is_entry)
  const exits = sortedActivities.filter((a) => !a.is_entry)
  const entryQty = entries.reduce((sum, a) => sum + a.quantity, 0)
  const exitQty = exits.reduce((sum, a) => sum + a.quantity, 0)
  const entryType = trade.direction === 'Short' ? 'Sell' : 'Buy'
  const exitType = trade.direction === 'Short' ? 'Buy' : 'Sell'

  // Duration only reads as a span for a closed trade; otherwise show "Open".
  const isClosed = trade.status === 'Closed'
  const duration = isClosed ? formatTradeDuration(trade.activities) : t('trade.detail.duration_open')

  const lightboxShot =
    lightboxIndex === null ? null : orderedScreenshots[lightboxIndex] ?? null

  return (
    <>
      <Stack gap="md">
        {/* Page header: identity + actions */}
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap="xs">
            {backLink}
            <Group gap="md" align="center" wrap="wrap">
              <Title order={2}>{assetName}</Title>
              <Text size="sm" c="dimmed" ff="monospace">
                {formatLocalDate(trade.trade_date)}
              </Text>
              <Group gap="xs">
                {trade.direction && (
                  <Badge variant="light" color={DIRECTION_COLOR[trade.direction]}>
                    {t(`trade.direction.${trade.direction}`)}
                  </Badge>
                )}
                <Badge variant="light" color={STATUS_COLOR[trade.status]}>
                  {trade.status}
                </Badge>
                <Badge variant="light" color={ACCOUNT_TYPE_COLOR[trade.account_type]}>
                  {t(`trade.account_type.${trade.account_type}`)}
                </Badge>
              </Group>
            </Group>
          </Stack>
          <Group gap="xs">
            <Button
              variant="default"
              leftSection={<IconPencil size={20} />}
              onClick={() => navigate(`/journal/${tradeId}/edit`)}
            >
              {t('common.actions.edit')}
            </Button>
            <ActionIcon
              variant="filled"
              color="red"
              size="lg"
              aria-label={t('trade.detail.delete_aria')}
              onClick={openDelete}
            >
              <IconTrash size={20} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Key metrics */}
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Card shadow="sm" radius="md" padding="md">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                {t('trade.detail.metrics.pnl')}
              </Text>
              <Text size="xl" fw={700} ff="monospace" c={signedColor(trade.performance_r)}>
                {formatPnl(trade.performance_r, trade.risk_per_trade)}
              </Text>
            </Stack>
          </Card>
          <Card shadow="sm" radius="md" padding="md">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                {t('trade.detail.metrics.stop_loss')}
              </Text>
              <Text size="xl" fw={700} ff="monospace">
                {trade.stop_loss !== null ? trade.stop_loss.toFixed(4) : '—'}
              </Text>
            </Stack>
          </Card>
          <Card shadow="sm" radius="md" padding="md">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                {t('trade.detail.metrics.duration')}
              </Text>
              <Text size="xl" fw={700} ff="monospace" c={isClosed ? undefined : 'dimmed'}>
                {duration}
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Activities */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            {t('trade.detail.sections.activities')}
          </Title>
          {sortedActivities.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('trade.detail.empty.activities')}
            </Text>
          ) : (
            <Stack gap="md">
              {/* Entries / Exits summary, side by side with computed totals */}
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={600} size="sm">
                      {t('trade.detail.entries')}
                    </Text>
                    <Badge variant="light" color={DIRECTION_COLOR.Long} size="sm">
                      {entryType}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      {t('trade.detail.totals.quantity')}{' '}
                      <Text span ff="monospace">
                        {entryQty}
                      </Text>
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('trade.detail.totals.avg_price')}{' '}
                      <Text span ff="monospace">
                        {trade.avg_entry_price !== null ? trade.avg_entry_price.toFixed(5) : '—'}
                      </Text>
                    </Text>
                  </Group>
                </Stack>
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={600} size="sm">
                      {t('trade.detail.exits')}
                    </Text>
                    <Badge variant="light" color={DIRECTION_COLOR.Short} size="sm">
                      {exitType}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      {t('trade.detail.totals.quantity')}{' '}
                      <Text span ff="monospace" c={exitQty > 0 ? undefined : 'dimmed'}>
                        {exitQty > 0 ? exitQty : '—'}
                      </Text>
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('trade.detail.totals.avg_price')}{' '}
                      <Text span ff="monospace" c={trade.avg_exit_price !== null ? undefined : 'dimmed'}>
                        {trade.avg_exit_price !== null ? trade.avg_exit_price.toFixed(5) : '—'}
                      </Text>
                    </Text>
                  </Group>
                </Stack>
              </SimpleGrid>

              <Divider />

              <Timeline active={sortedActivities.length} bulletSize={22} lineWidth={2}>
              {sortedActivities.map((activity) => (
                <Timeline.Item
                  key={activity.id}
                  bullet={
                    activity.is_entry ? <IconLogin size={12} /> : <IconLogout size={12} />
                  }
                  title={
                    <Group gap="xs">
                      <Badge
                        variant="light"
                        color={activity.type === 'Buy' ? 'teal' : 'orange'}
                        size="sm"
                      >
                        {activity.type}
                      </Badge>
                      <Badge variant="outline" color="gray" size="sm">
                        {activity.is_entry ? t('trade.detail.entry') : t('trade.detail.exit')}
                      </Badge>
                    </Group>
                  }
                >
                  <Group gap="xs">
                    <Text size="sm" ff="monospace">
                      {activity.price.toFixed(4)} &times; {activity.quantity}
                    </Text>
                    <Text size="sm" c="dimmed" ff="monospace">
                      {formatLocalDate(activity.date)}
                    </Text>
                  </Group>
                </Timeline.Item>
              ))}
              </Timeline>
            </Stack>
          )}
        </Card>

        {/* Tags & emotions, side by side on wide screens */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Card shadow="sm" radius="md" padding="md">
            <Title order={4} mb="sm">
              {t('trade.detail.sections.tags')}
            </Title>
            {trade.tags.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t('trade.detail.empty.tags')}
              </Text>
            ) : (
              <Group gap="xs">
                {trade.tags.map((tag) => (
                  <Badge key={tag.id} variant="light" color="gray">
                    {tag.name}
                  </Badge>
                ))}
              </Group>
            )}
          </Card>

          <Card shadow="sm" radius="md" padding="md">
            <Title order={4} mb="sm">
              {t('trade.detail.sections.emotions')}
            </Title>
            {trade.emotions.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t('trade.detail.empty.emotions')}
              </Text>
            ) : (
              <Stack gap="sm">
                {EMOTION_CATEGORIES.filter((category) =>
                  trade.emotions.some((e) => e.category === category),
                ).map((category) => (
                  <Stack key={category} gap="xs">
                    <Text size="sm" fw={600} c="dimmed">
                      {t(CATEGORY_I18N_KEYS[category])}
                    </Text>
                    <Group gap="xs">
                      {trade.emotions
                        .filter((e) => e.category === category)
                        .map((emotion) => (
                          <Badge
                            key={emotion.id}
                            variant="light"
                            color={SEVERITY_COLOR[emotion.severity]}
                          >
                            {emotion.name}
                          </Badge>
                        ))}
                    </Group>
                  </Stack>
                ))}
              </Stack>
            )}
          </Card>
        </SimpleGrid>

        {/* Notes */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            {t('trade.detail.sections.notes')}
          </Title>
          {trade.notes ? (
            <Text size="sm" className={classes.notes}>
              {trade.notes}
            </Text>
          ) : (
            <Text c="dimmed" size="sm">
              {t('trade.detail.empty.notes')}
            </Text>
          )}
        </Card>

        {/* Screenshots */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            {t('trade.detail.sections.screenshots')}
          </Title>
          {trade.screenshots.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('trade.detail.empty.screenshots')}
            </Text>
          ) : (
            <Stack gap="lg">
              {Array.from(screenshotGroups.entries()).map(([label, shots]) => (
                <Stack key={label} gap="sm">
                  <Divider
                    labelPosition="left"
                    label={
                      <Badge variant="light" color="gray" size="sm" radius="sm">
                        {label}
                      </Badge>
                    }
                  />
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                    {shots.map((shot) => (
                      <Stack key={shot.id} gap={6}>
                        <button
                          type="button"
                          className={classes.thumbnail}
                          onClick={() => setLightboxIndex(orderedScreenshots.indexOf(shot))}
                          aria-label={t('trade.detail.view_screenshot')}
                        >
                          <Image
                            src={`/api/screenshots/${shot.filename}`}
                            height={120}
                            fit="contain"
                            alt={shot.label ?? shot.filename}
                          />
                          <span className={classes.thumbnailOverlay}>
                            <IconZoomIn size={24} />
                          </span>
                        </button>
                        {shot.label && (
                          <Text size="xs" ta="center" lineClamp={2} className={classes.caption}>
                            {shot.label}
                          </Text>
                        )}
                      </Stack>
                    ))}
                  </SimpleGrid>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      </Stack>

      {/* Lightbox modal */}
      <Modal
        opened={lightboxShot !== null}
        onClose={() => setLightboxIndex(null)}
        fullScreen
        title={lightboxShot?.filename ?? ''}
      >
        {lightboxShot && (
          <Group gap="sm" align="center" wrap="nowrap">
            <ActionIcon
              variant="default"
              size="lg"
              aria-label={t('trade.detail.prev_screenshot')}
              disabled={lightboxIndex === 0}
              onClick={() =>
                setLightboxIndex((i) => (i === null ? i : Math.max(0, i - 1)))
              }
            >
              <IconChevronLeft size={20} />
            </ActionIcon>
            <Image
              src={`/api/screenshots/${lightboxShot.filename}`}
              fit="contain"
              flex={1}
              mah="80vh"
              alt={lightboxShot.filename}
            />
            <ActionIcon
              variant="default"
              size="lg"
              aria-label={t('trade.detail.next_screenshot')}
              disabled={lightboxIndex === orderedScreenshots.length - 1}
              onClick={() =>
                setLightboxIndex((i) =>
                  i === null ? i : Math.min(orderedScreenshots.length - 1, i + 1),
                )
              }
            >
              <IconChevronRight size={20} />
            </ActionIcon>
          </Group>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal opened={deleteOpened} onClose={closeDelete} title={t('trade.detail.delete_modal.title')} centered>
        <Stack gap="md">
          <Text size="sm">{t('trade.detail.delete_modal.body')}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDelete}>
              {t('common.actions.cancel')}
            </Button>
            <Button color="red" loading={deletePending} onClick={handleDelete}>
              {t('common.actions.delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
