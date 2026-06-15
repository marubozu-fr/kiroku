import { useState } from 'react'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { emotionsApi } from '@/services/referenceData'
import { CATEGORY_I18N_KEYS, EMOTION_CATEGORIES } from '@/types/referenceData'
import type { Emotion, EmotionSeverity } from '@/types/referenceData'
import { DataStates } from './DataStates'
import { DeleteEntityModal } from './DeleteEntityModal'
import { EmotionModal } from './EmotionModal'
import { EmotionsOnboarding } from './EmotionsOnboarding'
import { useDeleteEntity } from './useDeleteEntity'

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
  // Dismissing onboarding is component-local: a fresh mount re-offers it while
  // the list is still empty. No persistence needed (per design).
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  const del = useDeleteEntity<Emotion>({
    countFn: emotionsApi.tradeCount,
    deleteFn: emotionsApi.remove,
    onDeleted: reload,
    successMessage: (emotion) => t('settings.emotions.notify.deleted', { name: emotion.name }),
    errorMessage: t('settings.emotions.notify.delete_error'),
  })

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (emotion: Emotion) => {
    setEditing(emotion)
    setModalOpen(true)
  }

  const grouped = data ?? {}
  const totalEmotions = Object.values(grouped).reduce(
    (sum, items) => sum + items.length,
    0,
  )

  // While empty (and not yet dismissed), the onboarding replaces the standard
  // empty state and the "+ New emotion" button so it is the single focal CTA.
  const showOnboarding =
    !loading && !error && totalEmotions === 0 && !onboardingDismissed

  if (showOnboarding) {
    return (
      <EmotionsOnboarding
        onImported={reload}
        onSkip={() => setOnboardingDismissed(true)}
      />
    )
  }

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
              <Title order={5}>{t(CATEGORY_I18N_KEYS[category])}</Title>
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
                    {(grouped[category] ?? []).map((emotion) => (
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
                              onClick={() => del.open(emotion)}
                              aria-label={t('settings.emotions.delete.aria', { name: emotion.name })}
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

      <DeleteEntityModal
        opened={del.target !== null}
        mode="cascade"
        i18nPrefix="settings.emotions.delete"
        entityName={del.target?.name ?? ''}
        tradeCount={del.tradeCount}
        countLoading={del.countLoading}
        countError={del.countError}
        deletePending={del.pending}
        onClose={del.close}
        onConfirm={del.confirm}
      />
    </>
  )
}
