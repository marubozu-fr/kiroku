import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconAlertTriangle, IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  Input,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { useForm } from '@mantine/form'
import dayjs from 'dayjs'
import { notifyError, notifySuccess } from '@/components/settings/notify'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi, emotionsApi, tagsApi } from '@/services/referenceData'
import { tradesApi } from '@/services/trades'
import { ASSET_CATEGORIES, EMOTION_CATEGORIES } from '@/types/referenceData'
import type { Emotion, EmotionSeverity } from '@/types/referenceData'
import type { ActivityType, TradeInput } from '@/types/trade'

// Severity colours per docs/DESIGN_SYSTEM.md (red reserved for P&L, but allowed
// here for the "Bad" emotion semantics as on the detail view).
const SEVERITY_COLOR: Record<EmotionSeverity, string> = {
  Good: 'green',
  Warning: 'orange',
  Bad: 'red',
}

const TIMEFRAME_UNITS: readonly { value: string; label: string }[] = [
  { value: 'm', label: 'Minutes' },
  { value: 'h', label: 'Hours' },
  { value: 'd', label: 'Days' },
  { value: 'w', label: 'Weeks' },
]

interface ActivityFormValue {
  type: ActivityType
  date: string
  price: number | string
  quantity: number | string
}

interface TradeFormValues {
  asset_id: string | null
  activities: ActivityFormValue[]
  stop_loss: number | string
  risk_per_trade: number | string
  tag_ids: string[]
  emotion_ids: string[]
  timeframe_unit: string | null
  timeframe_value: number | string
  notes: string
  missed_opportunity: boolean
}

function emptyActivity(): ActivityFormValue {
  return { type: 'Buy', date: dayjs().toISOString(), price: '', quantity: '' }
}

/** Coerce a NumberInput value (number or empty string) to a number or null. */
function toNumberOrNull(value: number | string): number | null {
  if (value === '' || value === null) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** True when a NumberInput value is a finite number strictly greater than 0. */
function isPositive(value: number | string): boolean {
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) && parsed > 0
}

/**
 * Add / edit form for a trade — the journal's most complex view.
 * Routes: /journal/new (create) and /journal/:id/edit (edit).
 */
export function TradeFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEdit = id !== undefined
  const tradeId = Number(id)

  const assets = useFetch(assetsApi.list)
  const tags = useFetch(tagsApi.list)
  const emotions = useFetch(emotionsApi.grouped)
  const tradeFetch = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        isEdit ? tradesApi.get(tradeId, signal) : Promise.resolve(null),
      [isEdit, tradeId],
    ),
  )

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Prefill the form from the loaded trade exactly once (edit mode). A ref
  // avoids re-triggering the effect and keeps user edits from being clobbered.
  const prefilled = useRef(false)

  const form = useForm<TradeFormValues>({
    initialValues: {
      asset_id: null,
      activities: [emptyActivity()],
      stop_loss: '',
      risk_per_trade: '',
      tag_ids: [],
      emotion_ids: [],
      timeframe_unit: null,
      timeframe_value: '',
      notes: '',
      missed_opportunity: false,
    },
    validate: {
      asset_id: (value) => (value ? null : 'Asset is required'),
      activities: {
        date: (value) => (value ? null : 'Date is required'),
        price: (value) => (isPositive(value) ? null : 'Price must be greater than 0'),
        quantity: (value) =>
          isPositive(value) ? null : 'Quantity must be greater than 0',
      },
      stop_loss: (value) =>
        value === '' || isPositive(value) ? null : 'Stop loss must be greater than 0',
      risk_per_trade: (value) => {
        if (value === '') return null
        const parsed = Number(value)
        return parsed > 0 && parsed <= 100 ? null : 'Risk must be between 0 and 100'
      },
      timeframe_value: (value, values) =>
        values.timeframe_unit && !isPositive(value)
          ? 'Enter a timeframe value'
          : null,
      timeframe_unit: (value, values) => {
        const hasValue = values.timeframe_value !== '' && values.timeframe_value !== null
        return hasValue && !value ? 'Pick a unit' : null
      },
    },
  })

  // --- Reference data, shaped for the selectors ---
  const assetOptions = useMemo(
    () =>
      ASSET_CATEGORIES.map((category) => ({
        group: category,
        items: (assets.data ?? [])
          .filter((asset) => asset.is_active && asset.category === category)
          .map((asset) => ({ value: String(asset.id), label: asset.name })),
      })).filter((group) => group.items.length > 0),
    [assets.data],
  )

  const tagOptions = useMemo(
    () =>
      (tags.data ?? [])
        .filter((tag) => tag.is_active)
        .map((tag) => ({ value: String(tag.id), label: tag.name })),
    [tags.data],
  )

  const emotionOptions = useMemo(
    () =>
      EMOTION_CATEGORIES.map((category) => ({
        group: category,
        items: (emotions.data?.[category] ?? []).map((emotion) => ({
          value: String(emotion.id),
          label: emotion.name,
        })),
      })).filter((group) => group.items.length > 0),
    [emotions.data],
  )

  const emotionById = useMemo(() => {
    const map = new Map<string, Emotion>()
    for (const list of Object.values(emotions.data ?? {})) {
      for (const emotion of list) {
        map.set(String(emotion.id), emotion)
      }
    }
    return map
  }, [emotions.data])

  // --- Prefill the form from the existing trade (edit mode) ---
  useEffect(() => {
    if (!isEdit || prefilled.current || !tradeFetch.data) {
      return
    }
    const trade = tradeFetch.data
    const sortedActivities = [...trade.activities].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    form.setValues({
      asset_id: trade.asset_id !== null ? String(trade.asset_id) : null,
      activities:
        sortedActivities.length > 0
          ? sortedActivities.map((activity) => ({
              type: activity.type,
              date: activity.date,
              price: activity.price,
              quantity: activity.quantity,
            }))
          : [emptyActivity()],
      stop_loss: trade.stop_loss ?? '',
      risk_per_trade: trade.risk_per_trade ?? '',
      tag_ids: trade.tags.map((tag) => String(tag.id)),
      emotion_ids: trade.emotions.map((emotion) => String(emotion.id)),
      timeframe_unit: trade.timeframe_unit ?? null,
      timeframe_value: trade.timeframe_value ?? '',
      notes: trade.notes ?? '',
      missed_opportunity: trade.missed_opportunity,
    })
    form.resetDirty()
    prefilled.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, tradeFetch.data])

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitError(null)
    setSubmitting(true)
    const payload: TradeInput = {
      asset_id: Number(values.asset_id),
      stop_loss: toNumberOrNull(values.stop_loss),
      notes: values.notes.trim() === '' ? null : values.notes.trim(),
      missed_opportunity: values.missed_opportunity,
      risk_per_trade: toNumberOrNull(values.risk_per_trade),
      timeframe_unit: values.timeframe_unit || null,
      timeframe_value: toNumberOrNull(values.timeframe_value),
      activities: values.activities.map((activity) => ({
        type: activity.type,
        price: Number(activity.price),
        quantity: Number(activity.quantity),
        date: activity.date,
      })),
      tag_ids: values.tag_ids.map(Number),
      emotion_ids: values.emotion_ids.map(Number),
    }
    try {
      const saved = isEdit
        ? await tradesApi.update(tradeId, payload)
        : await tradesApi.create(payload)
      notifySuccess(isEdit ? 'Trade updated' : 'Trade created')
      navigate(`/journal/${saved.id}`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not save trade'
      setSubmitError(message)
      notifyError(message)
    } finally {
      setSubmitting(false)
    }
  })

  const backTo = isEdit ? `/journal/${tradeId}` : '/journal'
  const backLink = (
    <Anchor component={Link} to={backTo} size="sm" c="dimmed">
      <Group gap="xs">
        <IconArrowLeft size={16} />
        {isEdit ? 'Back to trade' : 'Back to journal'}
      </Group>
    </Anchor>
  )

  // --- Loading / error states ---
  const referenceError = assets.error ?? tags.error ?? emotions.error
  const loading = assets.loading || tags.loading || emotions.loading || tradeFetch.loading

  if (tradeFetch.error) {
    const isNotFound =
      tradeFetch.error.toLowerCase().includes('404') ||
      tradeFetch.error.toLowerCase().includes('not found')
    return (
      <Stack gap="md" align="flex-start">
        {backLink}
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={20} />}
          title={isNotFound ? 'Trade not found' : 'Could not load trade'}
        >
          {isNotFound ? (
            <Text size="sm">
              This trade does not exist or has been deleted.{' '}
              <Anchor component={Link} to="/journal">
                Return to journal
              </Anchor>
            </Text>
          ) : (
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{tradeFetch.error}</Text>
              <Button variant="default" size="xs" onClick={tradeFetch.reload}>
                Retry
              </Button>
            </Stack>
          )}
        </Alert>
      </Stack>
    )
  }

  if (loading) {
    return (
      <Stack gap="md">
        <Skeleton height={32} w={200} radius="sm" />
        <Skeleton height={120} radius="sm" />
        <Skeleton height={180} radius="sm" />
        <Skeleton height={120} radius="sm" />
      </Stack>
    )
  }

  if (referenceError) {
    const reloadAll = () => {
      assets.reload()
      tags.reload()
      emotions.reload()
    }
    return (
      <Stack gap="md" align="flex-start">
        {backLink}
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={20} />}
          title="Could not load form data"
        >
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{referenceError}</Text>
            <Button variant="default" size="xs" onClick={reloadAll}>
              Retry
            </Button>
          </Stack>
        </Alert>
      </Stack>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Stack gap="xs">
          {backLink}
          <Title order={2}>{isEdit ? 'Edit trade' : 'New trade'}</Title>
        </Stack>

        {submitError && (
          <Alert color="orange" icon={<IconAlertTriangle size={20} />} title="Could not save trade">
            {submitError}
          </Alert>
        )}

        {/* Asset */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            Asset
          </Title>
          <Select
            label="Asset"
            placeholder={
              assetOptions.length === 0 ? 'No assets — add one in Settings' : 'Pick an asset'
            }
            withAsterisk
            searchable
            data={assetOptions}
            disabled={assetOptions.length === 0}
            {...form.getInputProps('asset_id')}
          />
        </Card>

        {/* Activities */}
        <Card shadow="sm" radius="md" padding="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Activities</Title>
            <Button
              variant="default"
              size="xs"
              leftSection={<IconPlus size={16} />}
              onClick={() => form.insertListItem('activities', emptyActivity())}
            >
              Add activity
            </Button>
          </Group>
          <Stack gap="md">
            {form.values.activities.map((_, index) => (
              <Grid key={index} align="flex-end" gutter="xs">
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <DateTimePicker
                    label="Date"
                    placeholder="Pick date & time"
                    withAsterisk
                    valueFormat="YYYY-MM-DD HH:mm"
                    value={
                      form.values.activities[index].date
                        ? dayjs(form.values.activities[index].date).toDate()
                        : null
                    }
                    onChange={(value) =>
                      form.setFieldValue(
                        `activities.${index}.date`,
                        value ? dayjs(value).toISOString() : '',
                      )
                    }
                    error={form.errors[`activities.${index}.date`]}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <Input.Wrapper label="Type">
                    <SegmentedControl
                      fullWidth
                      data={[
                        { label: 'Buy', value: 'Buy' },
                        { label: 'Sell', value: 'Sell' },
                      ]}
                      {...form.getInputProps(`activities.${index}.type`)}
                    />
                  </Input.Wrapper>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2 }}>
                  <NumberInput
                    label="Price"
                    placeholder="0.00"
                    withAsterisk
                    min={0}
                    step={0.0001}
                    {...form.getInputProps(`activities.${index}.price`)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2 }}>
                  <NumberInput
                    label="Quantity"
                    placeholder="0"
                    withAsterisk
                    min={0}
                    {...form.getInputProps(`activities.${index}.quantity`)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <Button
                    variant="subtle"
                    color="gray"
                    fullWidth
                    leftSection={<IconTrash size={16} />}
                    disabled={form.values.activities.length <= 1}
                    onClick={() => form.removeListItem('activities', index)}
                  >
                    Remove
                  </Button>
                </Grid.Col>
              </Grid>
            ))}
          </Stack>
        </Card>

        {/* Risk & timeframe */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            Risk &amp; timeframe
          </Title>
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput
                label="Stop loss"
                placeholder="Stop loss price"
                min={0}
                step={0.0001}
                {...form.getInputProps('stop_loss')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput
                label="Risk per trade (%)"
                placeholder="e.g. 1"
                min={0}
                max={100}
                suffix="%"
                {...form.getInputProps('risk_per_trade')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 6 }}>
              <NumberInput
                label="Timeframe value"
                placeholder="e.g. 15"
                min={0}
                allowDecimal={false}
                {...form.getInputProps('timeframe_value')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 6 }}>
              <Select
                label="Timeframe unit"
                placeholder="Pick a unit"
                clearable
                data={[...TIMEFRAME_UNITS]}
                {...form.getInputProps('timeframe_unit')}
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* Tags & emotions */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            Tags &amp; emotions
          </Title>
          <Stack gap="md">
            <MultiSelect
              label="Tags"
              placeholder={tagOptions.length === 0 ? 'No tags available' : 'Pick tags'}
              searchable
              clearable
              data={tagOptions}
              disabled={tagOptions.length === 0}
              {...form.getInputProps('tag_ids')}
            />
            <MultiSelect
              label="Emotions"
              placeholder={emotionOptions.length === 0 ? 'No emotions available' : 'Pick emotions'}
              searchable
              clearable
              data={emotionOptions}
              disabled={emotionOptions.length === 0}
              renderOption={({ option }) => {
                const emotion = emotionById.get(option.value)
                return (
                  <Group gap="xs" wrap="nowrap">
                    {emotion && (
                      <Badge size="xs" variant="light" color={SEVERITY_COLOR[emotion.severity]}>
                        {emotion.severity}
                      </Badge>
                    )}
                    <span>{option.label}</span>
                  </Group>
                )
              }}
              {...form.getInputProps('emotion_ids')}
            />
          </Stack>
        </Card>

        {/* Notes & flags */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            Notes
          </Title>
          <Stack gap="md">
            <Textarea
              label="Notes"
              placeholder="Trade rationale, observations…"
              autosize
              minRows={3}
              maxRows={10}
              {...form.getInputProps('notes')}
            />
            <Checkbox
              label="Missed opportunity"
              description="A trade you identified but did not actually take"
              {...form.getInputProps('missed_opportunity', { type: 'checkbox' })}
            />
          </Stack>
        </Card>

        <Group justify="flex-end">
          <Button variant="default" onClick={() => navigate(backTo)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create trade'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
