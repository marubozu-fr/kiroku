import { useEffect, useState } from 'react'
import { Autocomplete, Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDebouncedValue } from '@mantine/hooks'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { massiveApi } from '@/services/massive'
import { preferencesApi } from '@/services/preferences'
import { assetsApi } from '@/services/referenceData'
import { ASSET_CATEGORIES } from '@/types/referenceData'
import type { Asset, AssetCategory } from '@/types/referenceData'
import { notifyError, notifySuccess } from './notify'

interface AssetModalProps {
  opened: boolean
  /** The asset being edited, or `null` to create a new one. */
  asset: Asset | null
  onClose: () => void
  /** Called with the created/updated asset after a successful save. */
  onSaved: (saved: Asset) => void
}

interface AssetFormValues {
  name: string
  category: AssetCategory | null
  currency: string
  /** Selected Massive ticker (e.g. `C:EURUSD`), or null when unlinked. */
  massiveTicker: string | null
  /** Raw text shown in the ticker Autocomplete input. */
  tickerInput: string
}

interface TickerOption {
  value: string
  label: string
}

export function AssetModal({ opened, asset, onClose, onSaved }: AssetModalProps) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)

  // A configured API key gates the whole ticker field: without one the search
  // backend returns nothing, so we disable the input and explain why.
  const { data: preferences } = useFetch(preferencesApi.get)
  const hasApiKey = (preferences?.massive_api_key ?? '') !== ''

  // Matches from the latest ticker search. Populated only from async callbacks
  // so the lint rule against synchronous setState-in-effect stays happy.
  const [tickerOptions, setTickerOptions] = useState<TickerOption[]>([])

  const form = useForm<AssetFormValues>({
    initialValues: { name: '', category: null, currency: '', massiveTicker: null, tickerInput: '' },
    validate: {
      name: (value) => {
        const length = value.trim().length
        if (length < 2) return t('settings.assets.form.name_min')
        if (length > 50) return t('settings.assets.form.name_max')
        return null
      },
      category: (value) => (value ? null : t('settings.assets.form.category_required')),
      currency: (value) =>
        value.trim().length > 10 ? t('settings.assets.form.currency_max') : null,
    },
  })

  // Prefill (edit) or clear (add) the form each time the modal opens.
  useEffect(() => {
    if (opened) {
      form.setValues({
        name: asset?.name ?? '',
        category: asset?.category ?? null,
        currency: asset?.currency ?? '',
        massiveTicker: asset?.massive_ticker ?? null,
        tickerInput: asset?.massive_ticker ?? '',
      })
      form.resetDirty()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, asset])

  // Fetch ticker matches once the debounced input reaches 2+ characters. Skip
  // when the input already equals the selected ticker (nothing new to search).
  const [debouncedTicker] = useDebouncedValue(form.values.tickerInput, 300)
  useEffect(() => {
    const query = debouncedTicker.trim()
    if (!hasApiKey || query.length < 2 || query === form.values.massiveTicker) {
      return
    }
    const controller = new AbortController()
    massiveApi
      .searchTickers(query, 'fx', controller.signal)
      .then((results) => {
        setTickerOptions(
          results.map((result) => ({
            value: result.ticker,
            label: result.name ? `${result.ticker} — ${result.name}` : result.ticker,
          })),
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTickerOptions([])
        }
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTicker, hasApiKey])

  // Mantine's Autocomplete reports the option label on select and the raw text
  // while typing. Resolve a label back to its ticker value; any other change
  // (typing or clearing) invalidates the previous selection.
  const handleTickerChange = (value: string) => {
    const selected = tickerOptions.find((option) => option.label === value)
    if (selected) {
      form.setFieldValue('tickerInput', selected.value)
      form.setFieldValue('massiveTicker', selected.value)
    } else {
      form.setFieldValue('tickerInput', value)
      form.setFieldValue('massiveTicker', null)
    }
  }

  // Suppress the dropdown once a ticker is chosen (input equals the selection)
  // or when there is too little to search, so no stale matches linger.
  const tickerQuery = form.values.tickerInput.trim()
  const showTickerOptions =
    tickerQuery.length >= 2 && tickerQuery !== form.values.massiveTicker

  // Non-blocking UX hint: a "/" in the name usually means the user typed a
  // pair (e.g. "EUR/USD") instead of the base name. Shown in orange (the
  // theme's error color) but never blocks submission.
  const nameProps = form.getInputProps('name')
  const nameSlashHint = form.values.name.includes('/')
    ? t('settings.assets.form.name_slash_hint')
    : null

  const handleSubmit = form.onSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      category: values.category as AssetCategory,
      currency: values.currency.trim() === '' ? null : values.currency.trim(),
      massive_ticker: values.massiveTicker,
    }
    setSubmitting(true)
    try {
      let saved: Asset
      if (asset) {
        saved = await assetsApi.update(asset.id, payload)
        notifySuccess(t('settings.assets.notify.updated', { name: payload.name }))
      } else {
        saved = await assetsApi.create(payload)
        notifySuccess(t('settings.assets.notify.created', { name: payload.name }))
      }
      onSaved(saved)
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : t('settings.assets.notify.save_error'))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={asset ? t('settings.assets.modal.edit_title') : t('settings.assets.modal.add_title')}
      centered
      closeOnClickOutside={false}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label={t('settings.assets.form.name_label')}
            placeholder={t('settings.assets.form.name_placeholder')}
            withAsterisk
            {...nameProps}
            error={nameProps.error ?? nameSlashHint}
          />
          <Select
            label={t('settings.assets.form.category_label')}
            placeholder={t('settings.assets.form.category_placeholder')}
            withAsterisk
            data={[...ASSET_CATEGORIES]}
            {...form.getInputProps('category')}
          />
          <TextInput
            label={t('settings.assets.form.currency_label')}
            placeholder={t('settings.assets.form.currency_placeholder')}
            {...form.getInputProps('currency')}
          />
          <Autocomplete
            label={t('settings.assets.form.massive_ticker_label')}
            placeholder={t('settings.assets.form.massive_ticker_placeholder')}
            description={
              hasApiKey
                ? t('settings.assets.form.massive_ticker_hint')
                : t('settings.assets.form.massive_ticker_no_api_key')
            }
            data={showTickerOptions ? tickerOptions : []}
            value={form.values.tickerInput}
            onChange={handleTickerChange}
            disabled={!hasApiKey}
            clearable
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {asset ? t('common.actions.save') : t('common.actions.create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
