import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      asset_id: (value) => (value ? null : t('trade.form.validation.asset_required')),
      activities: {
        date: (value) => (value ? null : t('trade.form.validation.date_required')),
        price: (value) => (isPositive(value) ? null : t('trade.form.validation.price_positive')),
        quantity: (value) =>
          isPositive(value) ? null : t('trade.form.validation.quantity_positive'),
      },
      stop_loss: (value) =>
        value === '' || isPositive(value) ? null : t('trade.form.validation.stop_loss_positive'),
      risk_per_trade: (value) => {
        if (value === '') return null
        const parsed = Number(value)
        return parsed > 0 && parsed <= 100 ? null : t('trade.form.validation.risk_range')
      },
      timeframe_value: (value, values) =>
        values.timeframe_unit && !isPositive(value)
          ? t('trade.form.validation.timeframe_value_required')
          : null,
      timeframe_unit: (value, values) => {
        const hasValue = values.timeframe_value !== '' && values.timeframe_value !== null
        return hasValue && !value ? t('trade.form.validation.timeframe_unit_required') : null
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
      notifySuccess(isEdit ? t('trade.form.notify.updated') : t('trade.form.notify.created'))
      navigate(`/journal/${saved.id}`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t('trade.form.notify.save_error')
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
        {isEdit ? t('trade.back_to_trade') : t('trade.back_to_journal')}
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
          title={isNotFound ? t('trade.not_found_title') : t('trade.load_error')}
        >
          {isNotFound ? (
            <Text size="sm">
              {t('trade.not_found_body')}{' '}
              <Anchor component={Link} to="/journal">
                {t('trade.return_to_journal')}
              </Anchor>
            </Text>
          ) : (
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{tradeFetch.error}</Text>
              <Button variant="default" size="xs" onClick={tradeFetch.reload}>
                {t('common.actions.retry')}
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
          title={t('trade.form.load_error')}
        >
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{referenceError}</Text>
            <Button variant="default" size="xs" onClick={reloadAll}>
              {t('common.actions.retry')}
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
          <Title order={2}>{isEdit ? t('trade.form.edit_title') : t('trade.form.new_title')}</Title>
        </Stack>

        {submitError && (
          <Alert color="orange" icon={<IconAlertTriangle size={20} />} title={t('trade.form.save_error_title')}>
            {submitError}
          </Alert>
        )}

        {/* Asset */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            {t('trade.form.sections.asset')}
          </Title>
          <Select
            label={t('trade.form.fields.asset_label')}
            placeholder={
              assetOptions.length === 0 ? t('trade.form.fields.asset_placeholder_empty') : t('trade.form.fields.asset_placeholder')
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
            <Title order={4}>{t('trade.form.sections.activities')}</Title>
            <Button
              variant="default"
              size="xs"
              leftSection={<IconPlus size={16} />}
              onClick={() => form.insertListItem('activities', emptyActivity())}
            >
              {t('trade.form.add_activity')}
            </Button>
          </Group>
          <Stack gap="md">
            {form.values.activities.map((_, index) => (
              <Grid key={index} align="flex-end" gutter="xs">
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <DateTimePicker
                    label={t('trade.form.fields.date_label')}
                    placeholder={t('trade.form.fields.date_placeholder')}
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
                  <Input.Wrapper label={t('trade.form.fields.type_label')}>
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
                    label={t('trade.form.fields.price_label')}
                    placeholder={t('trade.form.fields.price_placeholder')}
                    withAsterisk
                    min={0}
                    step={0.0001}
                    {...form.getInputProps(`activities.${index}.price`)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2 }}>
                  <NumberInput
                    label={t('trade.form.fields.quantity_label')}
                    placeholder={t('trade.form.fields.quantity_placeholder')}
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
                    {t('trade.form.remove_activity')}
                  </Button>
                </Grid.Col>
              </Grid>
            ))}
          </Stack>
        </Card>

        {/* Risk & timeframe */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            {t('trade.form.sections.risk_timeframe')}
          </Title>
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput
                label={t('trade.form.fields.stop_loss_label')}
                placeholder={t('trade.form.fields.stop_loss_placeholder')}
                min={0}
                step={0.0001}
                {...form.getInputProps('stop_loss')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput
                label={t('trade.form.fields.risk_label')}
                placeholder={t('trade.form.fields.risk_placeholder')}
                min={0}
                max={100}
                suffix="%"
                {...form.getInputProps('risk_per_trade')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 6 }}>
              <NumberInput
                label={t('trade.form.fields.timeframe_value_label')}
                placeholder={t('trade.form.fields.timeframe_value_placeholder')}
                min={0}
                allowDecimal={false}
                {...form.getInputProps('timeframe_value')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 6 }}>
              <Select
                label={t('trade.form.fields.timeframe_unit_label')}
                placeholder={t('trade.form.fields.timeframe_unit_placeholder')}
                clearable
                data={TIMEFRAME_UNITS.map((unit) => ({ value: unit.value, label: t(`trade.form.timeframe_units.${unit.value}`) }))}
                {...form.getInputProps('timeframe_unit')}
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* Tags & emotions */}
        <Card shadow="sm" radius="md" padding="md">
          <Title order={4} mb="sm">
            {t('trade.form.sections.tags_emotions')}
          </Title>
          <Stack gap="md">
            <MultiSelect
              label={t('trade.form.fields.tags_label')}
              placeholder={tagOptions.length === 0 ? t('trade.form.fields.tags_placeholder_empty') : t('trade.form.fields.tags_placeholder')}
              searchable
              clearable
              data={tagOptions}
              disabled={tagOptions.length === 0}
              {...form.getInputProps('tag_ids')}
            />
            <MultiSelect
              label={t('trade.form.fields.emotions_label')}
              placeholder={emotionOptions.length === 0 ? t('trade.form.fields.emotions_placeholder_empty') : t('trade.form.fields.emotions_placeholder')}
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
            {t('trade.form.sections.notes')}
          </Title>
          <Stack gap="md">
            <Textarea
              label={t('trade.form.fields.notes_label')}
              placeholder={t('trade.form.fields.notes_placeholder')}
              autosize
              minRows={3}
              maxRows={10}
              {...form.getInputProps('notes')}
            />
            <Checkbox
              label={t('trade.form.fields.missed_opportunity_label')}
              description={t('trade.form.fields.missed_opportunity_description')}
              {...form.getInputProps('missed_opportunity', { type: 'checkbox' })}
            />
          </Stack>
        </Card>

        <Group justify="flex-end">
          <Button variant="default" onClick={() => navigate(backTo)}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? t('trade.form.save_changes') : t('trade.form.create_trade')}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
