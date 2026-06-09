import { useEffect, useState } from 'react'
import { Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { tagsApi } from '@/services/referenceData'
import type { Tag } from '@/types/referenceData'
import { notifyError, notifySuccess } from './notify'

interface TagModalProps {
  opened: boolean
  /** The tag being edited, or `null` to create a new one. */
  tag: Tag | null
  onClose: () => void
  onSaved: () => void
}

interface TagFormValues {
  name: string
  description: string
}

export function TagModal({ opened, tag, onClose, onSaved }: TagModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<TagFormValues>({
    initialValues: { name: '', description: '' },
    validate: {
      name: (value) => {
        const length = value.trim().length
        if (length < 3) return 'Name must be at least 3 characters'
        if (length > 100) return 'Name must be at most 100 characters'
        return null
      },
      description: (value) =>
        value.length > 500 ? 'Description must be at most 500 characters' : null,
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
      if (tag) {
        await tagsApi.update(tag.id, payload)
        notifySuccess(`${payload.name} updated`)
      } else {
        await tagsApi.create(payload)
        notifySuccess(`${payload.name} created`)
      }
      onSaved()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : 'Could not save tag')
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={tag ? 'Edit tag' : 'Add tag'}
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="Breakout"
            withAsterisk
            {...form.getInputProps('name')}
          />
          <Textarea
            label="Description"
            placeholder="Optional notes about when this tag applies"
            autosize
            minRows={2}
            {...form.getInputProps('description')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {tag ? 'Save' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
