import { useEffect, useState } from 'react'
import { Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { emotionsApi } from '@/services/referenceData'
import {
  EMOTION_CATEGORIES,
  EMOTION_SEVERITIES,
} from '@/types/referenceData'
import type { Emotion, EmotionCategory, EmotionSeverity } from '@/types/referenceData'
import { notifyError, notifySuccess } from './notify'

interface EmotionModalProps {
  opened: boolean
  /** The emotion being edited, or `null` to create a new one. */
  emotion: Emotion | null
  onClose: () => void
  onSaved: () => void
}

interface EmotionFormValues {
  name: string
  description: string
  severity: EmotionSeverity | null
  category: EmotionCategory | null
}

export function EmotionModal({ opened, emotion, onClose, onSaved }: EmotionModalProps) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<EmotionFormValues>({
    initialValues: { name: '', description: '', severity: null, category: null },
    validate: {
      name: (value) => {
        const length = value.trim().length
        if (length < 3) return t('settings.emotions.form.name_min')
        if (length > 100) return t('settings.emotions.form.name_max')
        return null
      },
      description: (value) =>
        value.length > 500 ? t('settings.emotions.form.description_max') : null,
      severity: (value) => (value ? null : t('settings.emotions.form.severity_required')),
      category: (value) => (value ? null : t('settings.emotions.form.category_required')),
    },
  })

  useEffect(() => {
    if (opened) {
      form.setValues({
        name: emotion?.name ?? '',
        description: emotion?.description ?? '',
        severity: emotion?.severity ?? null,
        category: emotion?.category ?? null,
      })
      form.resetDirty()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, emotion])

  const handleSubmit = form.onSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() === '' ? null : values.description.trim(),
      severity: values.severity as EmotionSeverity,
      category: values.category as EmotionCategory,
    }
    setSubmitting(true)
    try {
      if (emotion) {
        await emotionsApi.update(emotion.id, payload)
        notifySuccess(t('settings.emotions.notify.updated', { name: payload.name }))
      } else {
        await emotionsApi.create(payload)
        notifySuccess(t('settings.emotions.notify.created', { name: payload.name }))
      }
      onSaved()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : t('settings.emotions.notify.save_error'))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={emotion ? t('settings.emotions.modal.edit_title') : t('settings.emotions.modal.add_title')}
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label={t('settings.emotions.form.name_label')}
            placeholder={t('settings.emotions.form.name_placeholder')}
            withAsterisk
            {...form.getInputProps('name')}
          />
          <Select
            label={t('settings.emotions.form.category_label')}
            placeholder={t('settings.emotions.form.category_placeholder')}
            withAsterisk
            data={[...EMOTION_CATEGORIES]}
            {...form.getInputProps('category')}
          />
          <Select
            label={t('settings.emotions.form.severity_label')}
            placeholder={t('settings.emotions.form.severity_placeholder')}
            withAsterisk
            data={[...EMOTION_SEVERITIES]}
            {...form.getInputProps('severity')}
          />
          <Textarea
            label={t('settings.emotions.form.description_label')}
            placeholder={t('settings.emotions.form.description_placeholder')}
            autosize
            minRows={2}
            {...form.getInputProps('description')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {emotion ? t('common.actions.save') : t('common.actions.create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
