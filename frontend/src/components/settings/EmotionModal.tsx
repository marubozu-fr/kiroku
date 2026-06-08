import { useEffect, useState } from 'react'
import { Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
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
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<EmotionFormValues>({
    initialValues: { name: '', description: '', severity: null, category: null },
    validate: {
      name: (value) => {
        const length = value.trim().length
        if (length < 3) return 'Name must be at least 3 characters'
        if (length > 100) return 'Name must be at most 100 characters'
        return null
      },
      description: (value) =>
        value.length > 500 ? 'Description must be at most 500 characters' : null,
      severity: (value) => (value ? null : 'Severity is required'),
      category: (value) => (value ? null : 'Category is required'),
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
        notifySuccess(`${payload.name} updated`)
      } else {
        await emotionsApi.create(payload)
        notifySuccess(`${payload.name} created`)
      }
      onSaved()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : 'Could not save emotion')
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={emotion ? 'Edit emotion' : 'Add emotion'}
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="FOMO"
            withAsterisk
            {...form.getInputProps('name')}
          />
          <Select
            label="Category"
            placeholder="Pick a category"
            withAsterisk
            data={[...EMOTION_CATEGORIES]}
            {...form.getInputProps('category')}
          />
          <Select
            label="Severity"
            placeholder="Pick a severity"
            withAsterisk
            data={[...EMOTION_SEVERITIES]}
            {...form.getInputProps('severity')}
          />
          <Textarea
            label="Description"
            placeholder="Optional notes about this emotion"
            autosize
            minRows={2}
            {...form.getInputProps('description')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {emotion ? 'Save' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
