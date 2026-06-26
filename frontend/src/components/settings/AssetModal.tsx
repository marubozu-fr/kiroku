import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Autocomplete, Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDebouncedValue } from '@mantine/hooks'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { massiveApi } from '@/services/massive'
import type { MassiveMarket } from '@/services/massive'
import { preferencesApi } from '@/services/preferences'
import { assetsApi } from '@/services/referenceData'
import { ASSET_CATEGORIES } from '@/types/referenceData'
import type { Asset, AssetCategory } from '@/types/referenceData'
import { notifyError, notifySuccess } from './notify'

// Each asset category maps to the Massive market its tickers live in, so the
// autocomplete searches the right reference set (issue #204). Futures are
// excluded: their tickers aren't searchable, so the user types a base symbol
// by hand instead of picking from the autocomplete (issue #209).
const CATEGORY_TO_MARKET: Record<Exclude<AssetCategory, 'Futures'>, MassiveMarket> = {
  Forex: 'fx',
  Crypto: 'crypto',
  Stock: 'stocks',
  ETF: 'stocks',
  Indices: 'indices',
}

// Base symbols are short alphanumeric codes; underscore is the only allowed
// separator (e.g. NQ, ES, GC, MES_1). Anything else is rejected (issue #209).
const FUTURES_BASE_SYMBOL = /^[A-Za-z0-9_]+$/

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
      // Only Futures take a hand-typed base symbol that needs format checking.
      // Other categories store a ticker chosen from the autocomplete, which is
      // already well-formed. Empty is allowed — the ticker link is optional.
      massiveTicker: (value, values) => {
        if (values.category !== 'Futures' || !value) return null
        return FUTURES_BASE_SYMBOL.test(value)
          ? null
          : t('settings.assets.form.futures_ticker_invalid')
      },
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

  // Futures take a free-text base symbol instead of an autocomplete search.
  const isFutures = form.values.category === 'Futures'

  // The asset's category selects which Massive market the autocomplete queries.
  // Null until a (non-Futures) category is picked, which also gates the field.
  const market =
    form.values.category && form.values.category !== 'Futures'
      ? CATEGORY_TO_MARKET[form.values.category]
      : null

  // Fetch ticker matches once the debounced input reaches 2+ characters. Skip
  // when no market is selected yet, or when the input already equals the
  // selected ticker (nothing new to search). Re-runs when the market changes
  // so switching category searches the new reference set.
  const [debouncedTicker] = useDebouncedValue(form.values.tickerInput, 300)
  useEffect(() => {
    const query = debouncedTicker.trim()
    if (!hasApiKey || !market || query.length < 2 || query === form.values.massiveTicker) {
      return
    }
    const controller = new AbortController()
    massiveApi
      .searchTickers(query, market, controller.signal)
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
  }, [debouncedTicker, hasApiKey, market])

  // Changing the category switches the Massive market, so any ticker chosen for
  // the old market no longer applies — clear the selection and stale matches.
  const categoryProps = form.getInputProps('category')
  const handleCategoryChange = (value: string | null) => {
    categoryProps.onChange(value)
    form.setFieldValue('massiveTicker', null)
    form.setFieldValue('tickerInput', '')
    setTickerOptions([])
  }

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

  // Futures store the typed base symbol directly — there is no label/value
  // resolution since nothing is fetched. Keep the visible input and the saved
  // value in lockstep; an empty field clears the link.
  const handleFuturesTickerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value
    form.setFieldValue('tickerInput', value)
    form.setFieldValue('massiveTicker', value === '' ? null : value)
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
            {...categoryProps}
            onChange={handleCategoryChange}
          />
          <TextInput
            label={t('settings.assets.form.currency_label')}
            placeholder={t('settings.assets.form.currency_placeholder')}
            {...form.getInputProps('currency')}
          />
          {/* The ticker field only makes sense with a Massive API key: without
              one there is no chart data to link, so hide it entirely (#209). */}
          {hasApiKey &&
            (isFutures ? (
              <TextInput
                label={t('settings.assets.form.massive_ticker_label')}
                placeholder={t('settings.assets.form.futures_ticker_placeholder')}
                description={t('settings.assets.form.futures_ticker_hint')}
                value={form.values.tickerInput}
                onChange={handleFuturesTickerChange}
                error={form.errors.massiveTicker}
              />
            ) : (
              <Autocomplete
                label={t('settings.assets.form.massive_ticker_label')}
                placeholder={t('settings.assets.form.massive_ticker_placeholder')}
                description={
                  !market
                    ? t('settings.assets.form.massive_ticker_select_category')
                    : t('settings.assets.form.massive_ticker_hint')
                }
                data={showTickerOptions ? tickerOptions : []}
                value={form.values.tickerInput}
                onChange={handleTickerChange}
                disabled={!market}
                clearable
              />
            ))}
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
