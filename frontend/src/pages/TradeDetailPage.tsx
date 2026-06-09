import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconAlertTriangle, IconArrowLeft, IconPencil, IconTrash } from '@tabler/icons-react'
import {
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
  const [lightboxScreenshot, setLightboxScreenshot] = useState<TradeScreenshot | null>(null)

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
          <Anchor component={Link} to="/journal" size="sm" c="dimmed">
            <Group gap="xs">
              <IconArrowLeft size={16} />
              Back to journal
            </Group>
          </Anchor>
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
        <Anchor component={Link} to="/journal" size="sm" c="dimmed">
          <Group gap="xs">
            <IconArrowLeft size={16} />
            Back to journal
          </Group>
        </Anchor>
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

  const duration = formatTradeDuration(trade.activities)

  const rrRatio: string =
    trade.risk !== null && trade.reward !== null && trade.risk !== 0
      ? (trade.reward / trade.risk).toFixed(2)
      : '—'

  return (
    <>
      <Stack gap="md">
        {/* Top row: back link + actions */}
        <Group justify="space-between" align="center">
          <Anchor component={Link} to="/journal" size="sm" c="dimmed">
            <Group gap="xs">
              <IconArrowLeft size={16} />
              Back to journal
            </Group>
          </Anchor>
          <Group gap="xs">
            <Button
              variant="default"
              leftSection={<IconPencil size={20} />}
              onClick={() => navigate(`/journal/${tradeId}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="filled"
              color="red"
              leftSection={<IconTrash size={20} />}
              onClick={openDelete}
            >
              Delete
            </Button>
          </Group>
        </Group>

        {/* Header card */}
        <Card shadow="sm" radius="md" padding="md">
          <Group gap="md" align="center" wrap="wrap">
            <Stack gap={2}>
              <Text size="xl" fw={700}>
                {assetName}
              </Text>
              <Text size="sm" c="dimmed" ff="monospace">
                {formatDate(trade.trade_date)}
              </Text>
            </Stack>
            <Group gap="xs">
              {trade.direction ? (
                <Badge variant="light" color={trade.direction === 'Long' ? 'blue' : 'grape'}>
                  {trade.direction}
                </Badge>
              ) : (
                <Text c="dimmed">—</Text>
              )}
              <Badge variant="light" color={STATUS_COLOR[trade.status]}>
                {trade.status}
              </Badge>
            </Group>
          </Group>
        </Card>

        {/* Key metrics */}
        <Card shadow="sm" radius="md" padding="md">
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                P&amp;L
              </Text>
              <Text size="xl" fw={700} ff="monospace" c={signedColor(trade.realized_pnl)}>
                {formatPnl(trade.realized_pnl)}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                R Value
              </Text>
              <Text size="xl" fw={700} ff="monospace" c={signedColor(trade.performance_r)}>
                {formatR(trade.performance_r)}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                Risk / Reward
              </Text>
              <Text size="xl" fw={700} ff="monospace">
                {rrRatio}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                Duration
              </Text>
              <Text size="xl" fw={700} ff="monospace">
                {duration}
              </Text>
            </Stack>
          </SimpleGrid>
        </Card>

        {/* Activities */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            Activities
          </Title>
          {sortedActivities.length === 0 ? (
            <Text c="dimmed" size="sm">
              No activities recorded.
            </Text>
          ) : (
            <Stack gap="xs">
              {sortedActivities.map((activity) => (
                <div key={activity.id} className={classes.activityRow}>
                  <div className={classes.activityDot} />
                  <div className={classes.activityLine}>
                    <Group gap="xs" align="center">
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
                      <Text size="sm" ff="monospace">
                        {activity.price.toFixed(4)} &times; {activity.quantity}
                      </Text>
                      <Text size="sm" c="dimmed" ff="monospace">
                        {formatDate(activity.date)}
                      </Text>
                    </Group>
                  </div>
                </div>
              ))}
            </Stack>
          )}
        </Card>

        {/* Tags */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            Tags
          </Title>
          {trade.tags.length === 0 ? (
            <Text c="dimmed" size="sm">
              No tags.
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

        {/* Emotions */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            Emotions
          </Title>
          {trade.emotions.length === 0 ? (
            <Text c="dimmed" size="sm">
              No emotions recorded.
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
              No notes.
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
              No screenshots.
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
                        height={100}
                        radius="sm"
                        fit="cover"
                        className={classes.thumbnail}
                        onClick={() => setLightboxScreenshot(shot)}
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
        opened={lightboxScreenshot !== null}
        onClose={() => setLightboxScreenshot(null)}
        size="xl"
        centered
        title={lightboxScreenshot?.filename ?? ''}
      >
        {lightboxScreenshot && (
          <Image
            src={`/api/screenshots/${lightboxScreenshot.filename}`}
            fit="contain"
            alt={lightboxScreenshot.filename}
          />
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
