import { useEffect, useState } from 'react'
import { Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
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
}

export function AssetModal({ opened, asset, onClose, onSaved }: AssetModalProps) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<AssetFormValues>({
    initialValues: { name: '', category: null, currency: '' },
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
      })
      form.resetDirty()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, asset])

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
