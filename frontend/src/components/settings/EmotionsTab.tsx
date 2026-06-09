import { useState } from 'react'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { Trans, useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { emotionsApi } from '@/services/referenceData'
import { EMOTION_CATEGORIES } from '@/types/referenceData'
import type { Emotion, EmotionSeverity } from '@/types/referenceData'
import { DataStates } from './DataStates'
import { EmotionModal } from './EmotionModal'
import { notifyError, notifySuccess } from './notify'

// Severity colours per docs/DESIGN_SYSTEM.md and issue #10.
const SEVERITY_COLOR: Record<EmotionSeverity, string> = {
  Good: 'green',
  Warning: 'orange',
  Bad: 'red',
}

export function EmotionsTab() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useFetch(emotionsApi.grouped)
  const [editing, setEditing] = useState<Emotion | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<Emotion | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (emotion: Emotion) => {
    setEditing(emotion)
    setModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleting) {
      return
    }
    setDeletePending(true)
    try {
      await emotionsApi.remove(deleting.id)
      notifySuccess(t('settings.emotions.notify.deleted', { name: deleting.name }))
      setDeleting(null)
      reload()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : t('settings.emotions.notify.delete_error'))
    } finally {
      setDeletePending(false)
    }
  }

  const grouped = data ?? {}
  const totalEmotions = Object.values(grouped).reduce(
    (sum, items) => sum + items.length,
    0,
  )

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={20} />} onClick={openAdd}>
          {t('settings.emotions.add')}
        </Button>
      </Group>

      <DataStates
        loading={loading}
        error={error}
        isEmpty={totalEmotions === 0}
        emptyMessage={t('settings.emotions.empty')}
        onRetry={reload}
      >
        <Stack gap="lg">
          {EMOTION_CATEGORIES.filter(
            (category) => (grouped[category]?.length ?? 0) > 0,
          ).map((category) => (
            <Stack key={category} gap="xs">
              <Title order={5}>{category}</Title>
              <Table.ScrollContainer minWidth={600}>
                <Table striped highlightOnHover fz="sm" verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th tt="uppercase" fz="xs" c="dimmed">
                        {t('settings.emotions.columns.name')}
                      </Table.Th>
                      <Table.Th tt="uppercase" fz="xs" c="dimmed">
                        {t('settings.emotions.columns.description')}
                      </Table.Th>
                      <Table.Th tt="uppercase" fz="xs" c="dimmed">
                        {t('settings.emotions.columns.severity')}
                      </Table.Th>
                      <Table.Th tt="uppercase" fz="xs" c="dimmed" w={100}>
                        {t('settings.emotions.columns.actions')}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {grouped[category].map((emotion) => (
                      <Table.Tr key={emotion.id}>
                        <Table.Td>{emotion.name}</Table.Td>
                        <Table.Td>
                          <Text c="dimmed" size="sm">
                            {emotion.description ?? '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={SEVERITY_COLOR[emotion.severity]} variant="light">
                            {emotion.severity}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => openEdit(emotion)}
                              aria-label={t('settings.emotions.edit_aria', { name: emotion.name })}
                            >
                              <IconPencil size={20} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setDeleting(emotion)}
                              aria-label={t('settings.emotions.delete_aria', { name: emotion.name })}
                            >
                              <IconTrash size={20} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          ))}
        </Stack>
      </DataStates>

      <EmotionModal
        opened={modalOpen}
        emotion={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          reload()
        }}
      />

      <Modal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('settings.emotions.delete_modal.title')}
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            <Trans
              i18nKey="settings.emotions.delete_modal.confirm"
              values={{ name: deleting?.name ?? '' }}
              components={{ strong: <strong /> }}
            />
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleting(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button color="red" loading={deletePending} onClick={confirmDelete}>
              {t('common.actions.delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
