import { useEffect, useState } from 'react'
import { Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { assetsApi } from '@/services/referenceData'
import { ASSET_CATEGORIES } from '@/types/referenceData'
import type { Asset, AssetCategory } from '@/types/referenceData'
import { notifyError, notifySuccess } from './notify'

interface AssetModalProps {
  opened: boolean
  /** The asset being edited, or `null` to create a new one. */
  asset: Asset | null
  onClose: () => void
  onSaved: () => void
}

interface AssetFormValues {
  name: string
  category: AssetCategory | null
  currency: string
}

export function AssetModal({ opened, asset, onClose, onSaved }: AssetModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<AssetFormValues>({
    initialValues: { name: '', category: null, currency: '' },
    validate: {
      name: (value) => {
        const length = value.trim().length
        if (length < 2) return 'Name must be at least 2 characters'
        if (length > 50) return 'Name must be at most 50 characters'
        return null
      },
      category: (value) => (value ? null : 'Category is required'),
      currency: (value) =>
        value.trim().length > 10 ? 'Currency must be at most 10 characters' : null,
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

  const handleSubmit = form.onSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      category: values.category as AssetCategory,
      currency: values.currency.trim() === '' ? null : values.currency.trim(),
    }
    setSubmitting(true)
    try {
      if (asset) {
        await assetsApi.update(asset.id, payload)
        notifySuccess(`${payload.name} updated`)
      } else {
        await assetsApi.create(payload)
        notifySuccess(`${payload.name} created`)
      }
      onSaved()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : 'Could not save asset')
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={asset ? 'Edit asset' : 'Add asset'}
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="EUR/USD"
            withAsterisk
            {...form.getInputProps('name')}
          />
          <Select
            label="Category"
            placeholder="Pick a category"
            withAsterisk
            data={[...ASSET_CATEGORIES]}
            {...form.getInputProps('category')}
          />
          <TextInput
            label="Currency"
            placeholder="USD"
            {...form.getInputProps('currency')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {asset ? 'Save' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
