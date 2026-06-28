import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CloseButton,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { preferencesApi } from '@/services/preferences'
import type { ChartTimeframe } from '@/types/preferences'
import {
  TIMEFRAME_UNITS,
  formatTimeframe,
  sortTimeframes,
} from '@/utils/timeframes'
import { notifyError, notifySuccess } from './notify'

/** Default chart timeframes + default entry timeframe (issues #234, #237). */
export function ChartTimeframesCard() {
  const { t } = useTranslation()
  const { data } = useFetch(preferencesApi.get)

  const [entryValue, setEntryValue] = useState<number | string>('')
  const [entryUnit, setEntryUnit] = useState<string | null>(null)
  const [entryError, setEntryError] = useState<string | null>(null)

  const [timeframes, setTimeframes] = useState<ChartTimeframe[]>([])
  const [addValue, setAddValue] = useState<number | string>('')
  const [addUnit, setAddUnit] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)

  const [warningThreshold, setWarningThreshold] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Seed the editable mirror from the fetched preferences exactly once.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !data) {
      return
    }
    seeded.current = true
    setEntryValue(data.entry_timeframe_value_default ?? '')
    setEntryUnit(data.entry_timeframe_unit_default ?? null)
    setTimeframes(sortTimeframes(data.chart_timeframes_default ?? []))
    setWarningThreshold(data.chart_timeframes_warning_threshold ?? null)
  }, [data])

  const unitOptions = TIMEFRAME_UNITS.map((unit) => ({
    value: unit,
    label: t(`trade.form.timeframe_units.${unit}`),
  }))

  const handleAdd = () => {
    const value = addValue === '' ? null : Number(addValue)
    if (value === null || !Number.isInteger(value) || value <= 0 || addUnit === null) {
      return
    }
    const next: ChartTimeframe = { value, unit: addUnit }
    const label = formatTimeframe(next)
    if (timeframes.some((tf) => formatTimeframe(tf) === label)) {
      setDuplicateError(t('settings.chart_timeframes.error_duplicate'))
      return
    }
    setTimeframes((current) => sortTimeframes([...current, next]))
    setAddValue('')
    setDuplicateError(null)
  }

  const handleRemove = (timeframe: ChartTimeframe) => {
    const label = formatTimeframe(timeframe)
    setTimeframes((current) =>
      current.filter((tf) => formatTimeframe(tf) !== label),
    )
    setDuplicateError(null)
  }

  const handleSave = async () => {
    const value = entryValue === '' ? null : Number(entryValue)
    const unit = entryUnit
    const bothEmpty = value === null && unit === null
    const bothSet = value !== null && value > 0 && unit !== null
    if (!bothEmpty && !bothSet) {
      setEntryError(t('settings.chart_timeframes.entry_incomplete'))
      return
    }
    setEntryError(null)
    setSaving(true)
    try {
      await preferencesApi.update({
        entry_timeframe_value_default: bothSet ? value : null,
        entry_timeframe_unit_default: bothSet ? unit : null,
        chart_timeframes_default: timeframes,
      })
      notifySuccess(t('settings.chart_timeframes.saved'))
    } catch {
      notifyError(t('settings.chart_timeframes.save_error'))
    } finally {
      setSaving(false)
    }
  }

  const overLimit =
    warningThreshold !== null && timeframes.length > warningThreshold

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="md">
        <Title order={4}>{t('settings.chart_timeframes.title')}</Title>

        <Stack gap={4}>
          <Text fw={500} fz="sm">
            {t('settings.chart_timeframes.entry_default_label')}
          </Text>
          <Text c="dimmed" fz="xs">
            {t('settings.chart_timeframes.entry_default_description')}
          </Text>
          <Group align="flex-start" gap="xs" mt={4}>
            <NumberInput
              aria-label={t('settings.chart_timeframes.entry_default_label')}
              placeholder={t('settings.chart_timeframes.value_placeholder')}
              min={1}
              allowDecimal={false}
              value={entryValue}
              onChange={setEntryValue}
              error={entryError}
              w={120}
            />
            <Select
              aria-label={t('trade.form.fields.timeframe_unit_label')}
              placeholder={t('trade.form.fields.timeframe_unit_placeholder')}
              data={unitOptions}
              value={entryUnit}
              onChange={setEntryUnit}
              clearable
              w={160}
            />
          </Group>
        </Stack>

        <Stack gap={4}>
          <Text fw={500} fz="sm">
            {t('settings.chart_timeframes.chart_default_label')}
          </Text>
          <Text c="dimmed" fz="xs">
            {t('settings.chart_timeframes.chart_default_description')}
          </Text>

          <Group align="flex-start" gap="xs" mt={4}>
            <NumberInput
              aria-label={t('settings.chart_timeframes.chart_default_label')}
              placeholder={t('settings.chart_timeframes.value_placeholder')}
              min={1}
              allowDecimal={false}
              value={addValue}
              onChange={setAddValue}
              error={duplicateError}
              w={120}
            />
            <Select
              aria-label={t('trade.form.fields.timeframe_unit_label')}
              placeholder={t('trade.form.fields.timeframe_unit_placeholder')}
              data={unitOptions}
              value={addUnit}
              onChange={setAddUnit}
              clearable
              w={160}
            />
            <Button variant="light" onClick={handleAdd}>
              {t('settings.chart_timeframes.add_timeframe')}
            </Button>
          </Group>

          {timeframes.length === 0 ? (
            <Text c="dimmed" fz="sm" mt="xs">
              {t('settings.chart_timeframes.empty')}
            </Text>
          ) : (
            <>
              <Group gap="xs" mt="xs">
                {timeframes.map((timeframe) => {
                  const label = formatTimeframe(timeframe)
                  return (
                    <Badge
                      key={label}
                      variant="light"
                      size="lg"
                      rightSection={
                        <CloseButton
                          size="xs"
                          aria-label={t('settings.chart_timeframes.remove_aria', {
                            timeframe: label,
                          })}
                          onClick={() => handleRemove(timeframe)}
                        />
                      }
                    >
                      {label}
                    </Badge>
                  )
                })}
              </Group>
              <Text c="dimmed" fz="xs">
                {t('settings.chart_timeframes.count', {
                  count: timeframes.length,
                })}
              </Text>
            </>
          )}

          {overLimit && warningThreshold !== null && (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle />}>
              {t('settings.chart_timeframes.warning_too_many', {
                count: warningThreshold,
              })}
            </Alert>
          )}
        </Stack>

        <Group>
          <Button
            size="xs"
            aria-label={t('settings.chart_timeframes.save_aria')}
            loading={saving}
            onClick={() => void handleSave()}
          >
            {t('common.actions.save')}
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}
