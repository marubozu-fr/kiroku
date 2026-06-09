import { useCallback, useMemo, useState } from 'react'
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
} from '@tabler/icons-react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
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
  STATUS_COLOR,
  formatDate,
  formatPnl,
  formatR,
  signedColor,
} from '@/components/journal/format'
import { notifyError, notifySuccess } from '@/components/settings/notify'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi } from '@/services/referenceData'
import { tradesApi } from '@/services/trades'
import { EMOTION_CATEGORIES } from '@/types/referenceData'
import type { EmotionSeverity } from '@/types/referenceData'
import type { TradeScreenshot } from '@/types/trade'
import classes from './TradeDetailPage.module.css'

// Severity colours per docs/DESIGN_SYSTEM.md — not re-exported from EmotionsTab.
const SEVERITY_COLOR: Record<EmotionSeverity, string> = {
  Good: 'green',
  Warning: 'orange',
  Bad: 'red',
}

/**
 * Read-only detail view for a single trade.
 * Route: /journal/:id
 */
export function TradeDetailPage() {
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
    return (assetsFetch.data ?? []).find((a) => a.id === assetId)?.name ?? '—'
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
      notifySuccess('Trade deleted')
      navigate('/journal')
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : 'Could not delete trade')
    } finally {
      setDeletePending(false)
      closeDelete()
    }
  }

  const backLink = (
    <Anchor component={Link} to="/journal" size="sm" c="dimmed">
      <Group gap="xs">
        <IconArrowLeft size={16} />
        Back to journal
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
          <Alert color="orange" icon={<IconAlertTriangle size={20} />} title="Trade not found">
            This trade does not exist or has been deleted.{' '}
            <Anchor component={Link} to="/journal">
              Return to journal
            </Anchor>
          </Alert>
        </Stack>
      )
    }

    return (
      <Stack gap="md" align="flex-start">
        {backLink}
        <Alert color="orange" icon={<IconAlertTriangle size={20} />} title="Could not load trade">
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{tradeFetch.error}</Text>
            <Button variant="default" size="xs" onClick={tradeFetch.reload}>
              Retry
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

  // Duration only reads as a span for a closed trade; otherwise show "Open".
  const isClosed = trade.status === 'Closed'
  const duration = isClosed ? formatTradeDuration(trade.activities) : 'Open'

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
                {formatDate(trade.trade_date)}
              </Text>
              <Group gap="xs">
                {trade.direction && (
                  <Badge variant="light" color={trade.direction === 'Long' ? 'blue' : 'grape'}>
                    {trade.direction}
                  </Badge>
                )}
                <Badge variant="light" color={STATUS_COLOR[trade.status]}>
                  {trade.status}
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
              Edit
            </Button>
            <ActionIcon
              variant="filled"
              color="red"
              size="lg"
              aria-label="Delete trade"
              onClick={openDelete}
            >
              <IconTrash size={20} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Key metrics */}
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Card shadow="sm" radius="md" padding="md">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                P&amp;L
              </Text>
              <Text size="xl" fw={700} ff="monospace" c={signedColor(trade.realized_pnl)}>
                {formatPnl(trade.realized_pnl)}
              </Text>
            </Stack>
          </Card>
          <Card shadow="sm" radius="md" padding="md">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                R Value
              </Text>
              <Text size="xl" fw={700} ff="monospace" c={signedColor(trade.performance_r)}>
                {formatR(trade.performance_r)}
              </Text>
            </Stack>
          </Card>
          <Card shadow="sm" radius="md" padding="md">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                Stop Loss
              </Text>
              <Text size="xl" fw={700} ff="monospace">
                {trade.stop_loss !== null ? trade.stop_loss.toFixed(4) : '—'}
              </Text>
            </Stack>
          </Card>
          <Card shadow="sm" radius="md" padding="md">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                Duration
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
            Activities
          </Title>
          {sortedActivities.length === 0 ? (
            <Text c="dimmed" size="sm">
              No activities recorded
            </Text>
          ) : (
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
                        {activity.is_entry ? 'Entry' : 'Exit'}
                      </Badge>
                    </Group>
                  }
                >
                  <Group gap="xs">
                    <Text size="sm" ff="monospace">
                      {activity.price.toFixed(4)} &times; {activity.quantity}
                    </Text>
                    <Text size="sm" c="dimmed" ff="monospace">
                      {formatDate(activity.date)}
                    </Text>
                  </Group>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Card>

        {/* Tags & emotions, side by side on wide screens */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Card shadow="sm" radius="md" padding="md">
            <Title order={4} mb="sm">
              Tags
            </Title>
            {trade.tags.length === 0 ? (
              <Text c="dimmed" size="sm">
                No tags
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
              Emotions
            </Title>
            {trade.emotions.length === 0 ? (
              <Text c="dimmed" size="sm">
                No emotions recorded
              </Text>
            ) : (
              <Stack gap="sm">
                {EMOTION_CATEGORIES.filter((category) =>
                  trade.emotions.some((e) => e.category === category),
                ).map((category) => (
                  <Stack key={category} gap="xs">
                    <Text size="sm" fw={600} c="dimmed">
                      {category}
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
            Notes
          </Title>
          {trade.notes ? (
            <Text size="sm" className={classes.notes}>
              {trade.notes}
            </Text>
          ) : (
            <Text c="dimmed" size="sm">
              No notes
            </Text>
          )}
        </Card>

        {/* Screenshots */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            Screenshots
          </Title>
          {trade.screenshots.length === 0 ? (
            <Text c="dimmed" size="sm">
              No screenshots
            </Text>
          ) : (
            <Stack gap="md">
              {Array.from(screenshotGroups.entries()).map(([label, shots]) => (
                <Stack key={label} gap="xs">
                  <Text size="sm" fw={600} c="dimmed">
                    {label}
                  </Text>
                  <SimpleGrid cols={{ base: 2, sm: 4 }}>
                    {shots.map((shot) => (
                      <Image
                        key={shot.id}
                        src={`/api/screenshots/${shot.filename}`}
                        height={120}
                        radius="sm"
                        fit="contain"
                        className={classes.thumbnail}
                        onClick={() => setLightboxIndex(orderedScreenshots.indexOf(shot))}
                        alt={shot.filename}
                      />
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
              aria-label="Previous screenshot"
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
              aria-label="Next screenshot"
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
      <Modal opened={deleteOpened} onClose={closeDelete} title="Delete trade" centered>
        <Stack gap="md">
          <Text size="sm">Delete this trade? This cannot be undone.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDelete}>
              Cancel
            </Button>
            <Button color="red" loading={deletePending} onClick={handleDelete}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
