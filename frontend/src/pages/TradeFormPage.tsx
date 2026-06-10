import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  FileButton,
  Grid,
  Group,
  Image,
  Input,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { useForm } from '@mantine/form'
import dayjs from 'dayjs'
import { AssetModal } from '@/components/settings/AssetModal'
import { EmotionModal } from '@/components/settings/EmotionModal'
import { notifyError, notifySuccess } from '@/components/settings/notify'
import { TagModal } from '@/components/settings/TagModal'
import {
  executionTotals,
  isPositiveNumber,
  isValidScreenshot,
} from '@/components/trade-form/execution'
import type { ExecutionRow } from '@/components/trade-form/execution'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi, emotionsApi, tagsApi } from '@/services/referenceData'
import { tradesApi } from '@/services/trades'
import { ASSET_CATEGORIES, EMOTION_CATEGORIES } from '@/types/referenceData'
import type { Asset, Emotion, EmotionSeverity, Tag } from '@/types/referenceData'
import type {
  AccountType,
  ActivityType,
  TradeDirection,
  TradeInput,
  TradeScreenshot,
} from '@/types/trade'
import classes from './TradeFormPage.module.css'

// Severity colours per docs/DESIGN_SYSTEM.md (red reserved for P&L, but allowed
// here for the "Bad" emotion semantics as on the detail view).
const SEVERITY_COLOR: Record<EmotionSeverity, string> = {
  Good: 'green',
  Warning: 'orange',
  Bad: 'red',
}

// Direction uses teal/grape (non-semantic) — green/red are reserved for P&L.
const DIRECTION_COLOR: Record<TradeDirection, string> = {
  Long: 'teal',
  Short: 'grape',
}

const ACCOUNT_TYPES: readonly AccountType[] = ['test', 'demo', 'live']

const TIMEFRAME_UNITS: readonly { value: string }[] = [
  { value: 'm' },
  { value: 'h' },
  { value: 'd' },
  { value: 'w' },
]

interface TradeFormValues {
  asset_id: string | null
  account_type: AccountType
  direction: TradeDirection | null
  stop_loss: number | string
  risk_per_trade: number | string
  entries: ExecutionRow[]
  exits: ExecutionRow[]
  tag_ids: string[]
  emotion_ids: string[]
  timeframe_unit: string | null
  timeframe_value: number | string
  notes: string
  missed_opportunity: boolean
}

/**
 * A screenshot staged client-side before upload. Each carries its own object
 * URL (created once on staging, revoked on removal/unmount) plus the required
 * timeframe and optional label entered in the form.
 */
interface StagedScreenshot {
  file: File
  url: string
  timeframe_unit: string | null
  timeframe_value: number | string
  label: string
}

function emptyRow(): ExecutionRow {
  return { date: dayjs().toISOString(), price: '', quantity: '' }
}

/** Coerce a NumberInput value (number or empty string) to a number or null. */
function toNumberOrNull(value: number | string): number | null {
  if (value === '' || value === null) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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
  // Inline creation modals for reference data, opened from the "+" buttons
  // beside each selector. They reuse the Settings creation modals (#55).
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [emotionModalOpen, setEmotionModalOpen] = useState(false)
  // Screenshots staged client-side with their timeframe + label; uploaded
  // after the trade is saved. On edit, existing screenshots are shown and may
  // be marked for deletion (applied on submit) — their metadata is read-only.
  const [staged, setStaged] = useState<StagedScreenshot[]>([])
  const [existingScreenshots, setExistingScreenshots] = useState<TradeScreenshot[]>([])
  const [removedScreenshotIds, setRemovedScreenshotIds] = useState<number[]>([])
  // Surface per-screenshot timeframe errors only after a submit attempt.
  const [showScreenshotErrors, setShowScreenshotErrors] = useState(false)
  // Prefill the form from the loaded trade exactly once (edit mode). A ref
  // avoids re-triggering the effect and keeps user edits from being clobbered.
  const prefilled = useRef(false)

  const form = useForm<TradeFormValues>({
    initialValues: {
      asset_id: null,
      account_type: 'live',
      direction: null,
      stop_loss: '',
      risk_per_trade: '',
      entries: [emptyRow()],
      exits: [],
      tag_ids: [],
      emotion_ids: [],
      timeframe_unit: null,
      timeframe_value: '',
      notes: '',
      missed_opportunity: false,
    },
    validate: {
      asset_id: (value) => (value ? null : t('trade.form.validation.asset_required')),
      direction: (value) => (value ? null : t('trade.form.validation.direction_required')),
      entries: {
        date: (value) => (value ? null : t('trade.form.validation.date_required')),
        price: (value) =>
          isPositiveNumber(value) ? null : t('trade.form.validation.price_positive'),
        quantity: (value) =>
          isPositiveNumber(value) ? null : t('trade.form.validation.quantity_positive'),
      },
      exits: {
        date: (value) => (value ? null : t('trade.form.validation.date_required')),
        price: (value) =>
          isPositiveNumber(value) ? null : t('trade.form.validation.price_positive'),
        quantity: (value) =>
          isPositiveNumber(value) ? null : t('trade.form.validation.quantity_positive'),
      },
      stop_loss: (value) =>
        isPositiveNumber(value) ? null : t('trade.form.validation.stop_loss_required'),
      risk_per_trade: (value) => {
        if (value === '') return null
        const parsed = Number(value)
        return parsed > 0 && parsed <= 100 ? null : t('trade.form.validation.risk_range')
      },
      timeframe_value: (value, values) =>
        values.timeframe_unit && !isPositiveNumber(value)
          ? t('trade.form.validation.timeframe_value_required')
          : null,
      timeframe_unit: (value, values) => {
        const hasValue = values.timeframe_value !== '' && values.timeframe_value !== null
        return hasValue && !value ? t('trade.form.validation.timeframe_unit_required') : null
      },
    },
  })

  // --- Derived: direction-driven types, totals, gating ---
  const direction = form.values.direction
  const entryType: ActivityType = direction === 'Short' ? 'Sell' : 'Buy'
  const exitType: ActivityType = direction === 'Short' ? 'Buy' : 'Sell'
  const hasEntry = form.values.entries.some((row) => isPositiveNumber(row.quantity))
  const entryTotals = executionTotals(form.values.entries)
  const exitTotals = executionTotals(form.values.exits)
  const exitExceedsEntry = exitTotals.quantity > entryTotals.quantity

  // --- Screenshot object URLs: created on staging, revoked on removal. A ref
  // mirrors the staged list so the unmount cleanup revokes whatever remains. ---
  const stagedRef = useRef<StagedScreenshot[]>([])
  useEffect(() => {
    stagedRef.current = staged
  }, [staged])
  useEffect(
    () => () => {
      stagedRef.current.forEach((shot) => URL.revokeObjectURL(shot.url))
    },
    [],
  )

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
    const sorted = [...trade.activities].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    const toRow = (activity: (typeof sorted)[number]): ExecutionRow => ({
      date: activity.date,
      price: activity.price,
      quantity: activity.quantity,
    })
    const entries = sorted.filter((a) => a.is_entry).map(toRow)
    const exits = sorted.filter((a) => !a.is_entry).map(toRow)
    form.setValues({
      asset_id: trade.asset_id !== null ? String(trade.asset_id) : null,
      account_type: trade.account_type,
      direction: trade.direction,
      stop_loss: trade.stop_loss ?? '',
      risk_per_trade: trade.risk_per_trade ?? '',
      entries: entries.length > 0 ? entries : [emptyRow()],
      exits,
      tag_ids: trade.tags.map((tag) => String(tag.id)),
      emotion_ids: trade.emotions.map((emotion) => String(emotion.id)),
      timeframe_unit: trade.timeframe_unit ?? null,
      timeframe_value: trade.timeframe_value ?? '',
      notes: trade.notes ?? '',
      missed_opportunity: trade.missed_opportunity,
    })
    setExistingScreenshots(trade.screenshots)
    form.resetDirty()
    prefilled.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, tradeFetch.data])

  // --- Screenshot staging handlers ---
  const handleAddFiles = (files: File[]) => {
    const valid = files.filter(isValidScreenshot)
    if (valid.length < files.length) {
      notifyError(t('trade.form.screenshots.invalid_file'))
    }
    if (valid.length > 0) {
      setStaged((current) => [
        ...current,
        ...valid.map((file) => ({
          file,
          url: URL.createObjectURL(file),
          timeframe_unit: null,
          timeframe_value: '',
          label: '',
        })),
      ])
    }
  }

  const removeStagedFile = (index: number) => {
    setStaged((current) => {
      const target = current[index]
      if (target) {
        URL.revokeObjectURL(target.url)
      }
      return current.filter((_, i) => i !== index)
    })
  }

  const updateStaged = (index: number, patch: Partial<StagedScreenshot>) => {
    setStaged((current) => current.map((shot, i) => (i === index ? { ...shot, ...patch } : shot)))
  }

  const removeExistingScreenshot = (screenshotId: number) => {
    setExistingScreenshots((current) => current.filter((shot) => shot.id !== screenshotId))
    setRemovedScreenshotIds((current) => [...current, screenshotId])
  }

  // --- Inline reference-data creation: refresh the list and select the result ---
  const handleAssetCreated = (asset: Asset) => {
    setAssetModalOpen(false)
    assets.reload()
    form.setFieldValue('asset_id', String(asset.id))
  }

  const handleTagCreated = (tag: Tag) => {
    setTagModalOpen(false)
    tags.reload()
    form.setFieldValue('tag_ids', [...form.values.tag_ids, String(tag.id)])
  }

  const handleEmotionCreated = (emotion: Emotion) => {
    setEmotionModalOpen(false)
    emotions.reload()
    form.setFieldValue('emotion_ids', [...form.values.emotion_ids, String(emotion.id)])
  }

  const handleSubmit = form.onSubmit(async (values) => {
    if (exitExceedsEntry) {
      const message = t('trade.form.validation.exit_exceeds_entry')
      setSubmitError(message)
      return
    }
    // Every staged screenshot needs a valid timeframe before it can be uploaded.
    const screenshotsInvalid = staged.some(
      (shot) => !shot.timeframe_unit || !isPositiveNumber(shot.timeframe_value),
    )
    if (screenshotsInvalid) {
      setShowScreenshotErrors(true)
      const message = t('trade.form.screenshots.timeframe_required')
      setSubmitError(message)
      notifyError(message)
      return
    }
    setSubmitError(null)
    setSubmitting(true)

    const activities = [
      ...values.entries.map((row) => ({
        type: entryType,
        price: Number(row.price),
        quantity: Number(row.quantity),
        date: row.date,
      })),
      ...values.exits.map((row) => ({
        type: exitType,
        price: Number(row.price),
        quantity: Number(row.quantity),
        date: row.date,
      })),
    ]

    const payload: TradeInput = {
      asset_id: Number(values.asset_id),
      account_type: values.account_type,
      stop_loss: toNumberOrNull(values.stop_loss),
      notes: values.notes.trim() === '' ? null : values.notes.trim(),
      missed_opportunity: values.missed_opportunity,
      risk_per_trade: toNumberOrNull(values.risk_per_trade),
      timeframe_unit: values.timeframe_unit || null,
      timeframe_value: toNumberOrNull(values.timeframe_value),
      activities,
      tag_ids: values.tag_ids.map(Number),
      emotion_ids: values.emotion_ids.map(Number),
    }

    try {
      const saved = isEdit
        ? await tradesApi.update(tradeId, payload)
        : await tradesApi.create(payload)

      // Apply screenshot changes against the saved trade id.
      try {
        for (const screenshotId of removedScreenshotIds) {
          await tradesApi.removeScreenshot(screenshotId)
        }
        for (const shot of staged) {
          await tradesApi.uploadScreenshot(saved.id, shot.file, {
            timeframe_unit: shot.timeframe_unit as string,
            timeframe_value: Number(shot.timeframe_value),
            label: shot.label.trim() === '' ? null : shot.label.trim(),
          })
        }
      } catch {
        notifyError(t('trade.form.screenshots.upload_error'))
      }

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

  const renderExecutionRows = (field: 'entries' | 'exits', disabled: boolean) =>
    form.values[field].map((_, index) => (
      <Stack key={index} gap="xs" className={classes.execRow}>
        <DateTimePicker
          aria-label={t(`trade.form.fields.${field === 'entries' ? 'entry' : 'exit'}_date_label`)}
          placeholder={t('trade.form.fields.date_placeholder')}
          size="xs"
          valueFormat="YYYY-MM-DD HH:mm"
          disabled={disabled}
          value={form.values[field][index].date ? dayjs(form.values[field][index].date).toDate() : null}
          onChange={(value) =>
            form.setFieldValue(
              `${field}.${index}.date`,
              value ? dayjs(value).toISOString() : '',
            )
          }
          error={form.errors[`${field}.${index}.date`]}
        />
        <Group gap="xs" align="flex-start" wrap="nowrap">
          <NumberInput
            aria-label={t('trade.form.fields.quantity_label')}
            placeholder={t('trade.form.fields.quantity_placeholder')}
            size="xs"
            min={0}
            disabled={disabled}
            flex={1}
            {...form.getInputProps(`${field}.${index}.quantity`)}
          />
          <NumberInput
            aria-label={t('trade.form.fields.price_label')}
            placeholder={t('trade.form.fields.price_placeholder')}
            size="xs"
            min={0}
            step={0.0001}
            disabled={disabled}
            flex={1}
            {...form.getInputProps(`${field}.${index}.price`)}
          />
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            aria-label={t('trade.form.remove_activity')}
            disabled={disabled || (field === 'entries' && form.values.entries.length <= 1)}
            onClick={() => form.removeListItem(field, index)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Stack>
    ))

  const renderTotals = (totals: { quantity: number; avgPrice: number | null }) => (
    <Group justify="space-between">
      <Text size="xs" c="dimmed">
        {t('trade.form.totals.quantity')}{' '}
        <Text span ff="monospace" c={totals.quantity > 0 ? undefined : 'dimmed'}>
          {totals.quantity > 0 ? totals.quantity : '—'}
        </Text>
      </Text>
      <Text size="xs" c="dimmed">
        {t('trade.form.totals.avg_price')}{' '}
        <Text span ff="monospace" c={totals.avgPrice !== null ? undefined : 'dimmed'}>
          {totals.avgPrice !== null ? totals.avgPrice.toFixed(5) : '—'}
        </Text>
      </Text>
    </Group>
  )

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap="xs">
            {backLink}
            <Title order={2}>
              {isEdit ? t('trade.form.edit_title') : t('trade.form.new_title')}
            </Title>
          </Stack>
          <Group gap="xs">
            <Button variant="default" onClick={() => navigate(backTo)}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {isEdit ? t('trade.form.save_changes') : t('trade.form.create_trade')}
            </Button>
          </Group>
        </Group>

        {submitError && (
          <Alert
            color="orange"
            icon={<IconAlertTriangle size={20} />}
            title={t('trade.form.save_error_title')}
          >
            {submitError}
          </Alert>
        )}

        <Grid gutter="md">
          {/* LEFT: Configuration */}
          <Grid.Col span={{ base: 12, sm: 5 }}>
            <Card shadow="sm" radius="md" padding="md">
              <Title order={4} mb="sm">
                {t('trade.form.sections.configuration')}
              </Title>
              <Stack gap="md">
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <Select
                    flex={1}
                    label={t('trade.form.fields.asset_label')}
                    placeholder={
                      assetOptions.length === 0
                        ? t('trade.form.fields.asset_placeholder_empty')
                        : t('trade.form.fields.asset_placeholder')
                    }
                    withAsterisk
                    searchable
                    data={assetOptions}
                    disabled={assetOptions.length === 0}
                    {...form.getInputProps('asset_id')}
                  />
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    aria-label={t('trade.form.fields.asset_add_aria')}
                    onClick={() => setAssetModalOpen(true)}
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                </Group>
                <Input.Wrapper label={t('trade.form.fields.account_type_label')} withAsterisk>
                  <SegmentedControl
                    fullWidth
                    data={ACCOUNT_TYPES.map((value) => ({
                      value,
                      label: t(`trade.account_type.${value}`),
                    }))}
                    {...form.getInputProps('account_type')}
                  />
                </Input.Wrapper>
                <Input.Wrapper label={t('trade.form.fields.timeframe_label')}>
                  <Grid gutter="xs">
                    <Grid.Col span={6}>
                      <Select
                        aria-label={t('trade.form.fields.timeframe_unit_label')}
                        placeholder={t('trade.form.fields.timeframe_unit_placeholder')}
                        clearable
                        data={TIMEFRAME_UNITS.map((unit) => ({
                          value: unit.value,
                          label: t(`trade.form.timeframe_units.${unit.value}`),
                        }))}
                        {...form.getInputProps('timeframe_unit')}
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <NumberInput
                        aria-label={t('trade.form.fields.timeframe_value_label')}
                        placeholder={t('trade.form.fields.timeframe_value_placeholder')}
                        min={0}
                        allowDecimal={false}
                        {...form.getInputProps('timeframe_value')}
                      />
                    </Grid.Col>
                  </Grid>
                </Input.Wrapper>
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <MultiSelect
                    flex={1}
                    label={t('trade.form.fields.tags_label')}
                    placeholder={
                      tagOptions.length === 0
                        ? t('trade.form.fields.tags_placeholder_empty')
                        : t('trade.form.fields.tags_placeholder')
                    }
                    searchable
                    clearable
                    data={tagOptions}
                    disabled={tagOptions.length === 0}
                    {...form.getInputProps('tag_ids')}
                  />
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    aria-label={t('trade.form.fields.tags_add_aria')}
                    onClick={() => setTagModalOpen(true)}
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                </Group>
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <MultiSelect
                    flex={1}
                    label={t('trade.form.fields.emotions_label')}
                    placeholder={
                      emotionOptions.length === 0
                        ? t('trade.form.fields.emotions_placeholder_empty')
                        : t('trade.form.fields.emotions_placeholder')
                    }
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
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    aria-label={t('trade.form.fields.emotions_add_aria')}
                    onClick={() => setEmotionModalOpen(true)}
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>

          {/* RIGHT: Activities + Notes + Screenshots */}
          <Grid.Col span={{ base: 12, sm: 7 }}>
            <Stack gap="md">
              <Card shadow="sm" radius="md" padding="md">
                <Title order={4} mb="sm">
                  {t('trade.form.sections.activities')}
                </Title>
                <Stack gap="md">
                  <Input.Wrapper
                    label={t('trade.form.fields.direction_label')}
                    withAsterisk
                    error={form.errors.direction}
                  >
                    <SegmentedControl
                      fullWidth
                      color={direction ? DIRECTION_COLOR[direction] : undefined}
                      data={[
                        { value: 'Long', label: t('trade.direction.Long') },
                        { value: 'Short', label: t('trade.direction.Short') },
                      ]}
                      value={direction ?? ''}
                      onChange={(value) => form.setFieldValue('direction', value as TradeDirection)}
                    />
                  </Input.Wrapper>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={t('trade.form.fields.stop_loss_label')}
                        placeholder={t('trade.form.fields.stop_loss_placeholder')}
                        withAsterisk
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
                  </Grid>

                  <Divider />

                  <Grid gutter="md">
                    {/* Entries */}
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Stack gap="xs" className={classes.execColumn}>
                        <Group gap="xs">
                          <Text fw={600} size="sm">
                            {t('trade.form.entries')}
                          </Text>
                          <Badge variant="light" color={DIRECTION_COLOR[direction ?? 'Long']} size="sm">
                            {entryType}
                          </Badge>
                        </Group>
                        {renderExecutionRows('entries', false)}
                        <Button
                          variant="light"
                          size="xs"
                          leftSection={<IconPlus size={16} />}
                          onClick={() => form.insertListItem('entries', emptyRow())}
                        >
                          {t('trade.form.add_entry')}
                        </Button>
                        {renderTotals(entryTotals)}
                      </Stack>
                    </Grid.Col>

                    {/* Exits */}
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Stack
                        gap="xs"
                        className={`${classes.execColumn} ${hasEntry ? '' : classes.execColumnDisabled}`}
                      >
                        <Group gap="xs">
                          <Text fw={600} size="sm">
                            {t('trade.form.exits')}
                          </Text>
                          <Badge variant="light" color={DIRECTION_COLOR[direction ?? 'Long']} size="sm">
                            {exitType}
                          </Badge>
                        </Group>
                        {form.values.exits.length === 0 ? (
                          <Text size="xs" c="dimmed">
                            {hasEntry
                              ? t('trade.form.exits_empty')
                              : t('trade.form.exits_locked')}
                          </Text>
                        ) : (
                          renderExecutionRows('exits', !hasEntry)
                        )}
                        <Button
                          variant="light"
                          size="xs"
                          leftSection={<IconPlus size={16} />}
                          disabled={!hasEntry}
                          onClick={() => form.insertListItem('exits', emptyRow())}
                        >
                          {t('trade.form.add_exit')}
                        </Button>
                        {renderTotals(exitTotals)}
                      </Stack>
                    </Grid.Col>
                  </Grid>

                  {exitExceedsEntry && (
                    <Text size="xs" c="orange">
                      {t('trade.form.validation.exit_exceeds_entry')}
                    </Text>
                  )}
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

              {/* Screenshots */}
              <Card shadow="sm" radius="md" padding="md">
                <Title order={4} mb="sm">
                  {t('trade.form.sections.screenshots')}
                </Title>
                <Stack gap="md">
                  <FileButton
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAddFiles}
                  >
                    {(props) => (
                      <Button
                        {...props}
                        variant="default"
                        leftSection={<IconUpload size={16} />}
                      >
                        {t('trade.form.screenshots.add')}
                      </Button>
                    )}
                  </FileButton>
                  <Text size="xs" c="dimmed">
                    {t('trade.form.screenshots.hint')}
                  </Text>

                  {existingScreenshots.length > 0 && (
                    <SimpleGrid cols={{ base: 2, sm: 3 }}>
                      {existingScreenshots.map((shot) => (
                        <Card key={shot.id} padding={4} radius="sm" className={classes.preview}>
                          <Image
                            src={`/api/screenshots/${shot.filename}`}
                            height={100}
                            radius="sm"
                            fit="contain"
                            className={classes.previewImage}
                            alt={shot.label ?? shot.filename}
                          />
                          {shot.timeframe_value !== null && shot.timeframe_unit !== null && (
                            <Badge size="xs" variant="light" mt={4}>
                              {`${shot.timeframe_value}${shot.timeframe_unit}`}
                            </Badge>
                          )}
                          {shot.label && (
                            <Text size="xs" c="dimmed" mt={2} lineClamp={2}>
                              {shot.label}
                            </Text>
                          )}
                          <ActionIcon
                            variant="filled"
                            color="red"
                            size="sm"
                            radius="xl"
                            className={classes.removeButton}
                            aria-label={t('trade.form.screenshots.remove')}
                            onClick={() => removeExistingScreenshot(shot.id)}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        </Card>
                      ))}
                    </SimpleGrid>
                  )}

                  {staged.length > 0 && (
                    <Stack gap="sm">
                      {staged.map((shot, index) => (
                        <Card key={shot.url} padding="sm" radius="sm" withBorder>
                          <Group align="flex-start" wrap="nowrap" gap="sm">
                            <Image
                              src={shot.url}
                              w={120}
                              h={90}
                              radius="sm"
                              fit="contain"
                              className={classes.previewImage}
                              alt={shot.file.name}
                            />
                            <Stack gap="xs" flex={1}>
                              <Grid gutter="xs">
                                <Grid.Col span={6}>
                                  <Select
                                    aria-label={t('trade.form.fields.timeframe_unit_label')}
                                    placeholder={t('trade.form.fields.timeframe_unit_placeholder')}
                                    data={TIMEFRAME_UNITS.map((unit) => ({
                                      value: unit.value,
                                      label: t(`trade.form.timeframe_units.${unit.value}`),
                                    }))}
                                    value={shot.timeframe_unit}
                                    onChange={(value) =>
                                      updateStaged(index, { timeframe_unit: value })
                                    }
                                    error={
                                      showScreenshotErrors && !shot.timeframe_unit
                                        ? t('trade.form.validation.timeframe_unit_required')
                                        : null
                                    }
                                  />
                                </Grid.Col>
                                <Grid.Col span={6}>
                                  <NumberInput
                                    aria-label={t('trade.form.fields.timeframe_value_label')}
                                    placeholder={t('trade.form.fields.timeframe_value_placeholder')}
                                    min={1}
                                    allowDecimal={false}
                                    value={shot.timeframe_value}
                                    onChange={(value) =>
                                      updateStaged(index, { timeframe_value: value })
                                    }
                                    error={
                                      showScreenshotErrors && !isPositiveNumber(shot.timeframe_value)
                                        ? t('trade.form.validation.timeframe_value_required')
                                        : null
                                    }
                                  />
                                </Grid.Col>
                              </Grid>
                              <TextInput
                                aria-label={t('trade.form.screenshots.label_label')}
                                placeholder={t('trade.form.screenshots.label_placeholder')}
                                value={shot.label}
                                onChange={(event) =>
                                  updateStaged(index, { label: event.currentTarget.value })
                                }
                              />
                            </Stack>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              aria-label={t('trade.form.screenshots.remove')}
                              onClick={() => removeStagedFile(index)}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>

      <AssetModal
        opened={assetModalOpen}
        asset={null}
        onClose={() => setAssetModalOpen(false)}
        onSaved={handleAssetCreated}
      />
      <TagModal
        opened={tagModalOpen}
        tag={null}
        onClose={() => setTagModalOpen(false)}
        onSaved={handleTagCreated}
      />
      <EmotionModal
        opened={emotionModalOpen}
        emotion={null}
        onClose={() => setEmotionModalOpen(false)}
        onSaved={handleEmotionCreated}
      />
    </form>
  )
}
