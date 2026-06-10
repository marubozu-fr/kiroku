import { useEffect, useState } from 'react'
import { Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { tagsApi } from '@/services/referenceData'
import type { Tag } from '@/types/referenceData'
import { notifyError, notifySuccess } from './notify'

interface TagModalProps {
  opened: boolean
  /** The tag being edited, or `null` to create a new one. */
  tag: Tag | null
  onClose: () => void
  /** Called with the created/updated tag after a successful save. */
  onSaved: (saved: Tag) => void
}

interface TagFormValues {
  name: string
  description: string
}

export function TagModal({ opened, tag, onClose, onSaved }: TagModalProps) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<TagFormValues>({
    initialValues: { name: '', description: '' },
    validate: {
      name: (value) => {
        const length = value.trim().length
        if (length < 3) return t('settings.tags.form.name_min')
        if (length > 100) return t('settings.tags.form.name_max')
        return null
      },
      description: (value) =>
        value.length > 500 ? t('settings.tags.form.description_max') : null,
    },
  })

  useEffect(() => {
    if (opened) {
      form.setValues({
        name: tag?.name ?? '',
        description: tag?.description ?? '',
      })
      form.resetDirty()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, tag])

  const handleSubmit = form.onSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() === '' ? null : values.description.trim(),
    }
    setSubmitting(true)
    try {
      let saved: Tag
      if (tag) {
        saved = await tagsApi.update(tag.id, payload)
        notifySuccess(t('settings.tags.notify.updated', { name: payload.name }))
      } else {
        saved = await tagsApi.create(payload)
        notifySuccess(t('settings.tags.notify.created', { name: payload.name }))
      }
      onSaved(saved)
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : t('settings.tags.notify.save_error'))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={tag ? t('settings.tags.modal.edit_title') : t('settings.tags.modal.add_title')}
      centered
      closeOnClickOutside={false}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label={t('settings.tags.form.name_label')}
            placeholder={t('settings.tags.form.name_placeholder')}
            withAsterisk
            {...form.getInputProps('name')}
          />
          <Textarea
            label={t('settings.tags.form.description_label')}
            placeholder={t('settings.tags.form.description_placeholder')}
            autosize
            minRows={2}
            {...form.getInputProps('description')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {tag ? t('common.actions.save') : t('common.actions.create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
