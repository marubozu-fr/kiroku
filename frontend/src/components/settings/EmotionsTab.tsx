import { useState } from 'react'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Select,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { emotionsApi } from '@/services/referenceData'
import {
  CATEGORY_I18N_KEYS,
  EMOTION_CATEGORIES,
  EMOTION_SEVERITIES,
} from '@/types/referenceData'
import type { Emotion, EmotionSeverity } from '@/types/referenceData'
import { DataStates } from './DataStates'
import { DeleteEntityModal } from './DeleteEntityModal'
import { EmotionModal } from './EmotionModal'
import { EmotionsOnboarding } from './EmotionsOnboarding'
import { FilterEmptyState } from './FilterEmptyState'
import { useDeleteEntity } from './useDeleteEntity'

// Severity colours per docs/DESIGN_SYSTEM.md and issue #10.
const SEVERITY_COLOR: Record<EmotionSeverity, string> = {
  Good: 'green',
  Warning: 'orange',
  Bad: 'red',
}

export function EmotionsTab() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useFetch(emotionsApi.list)
  const [editing, setEditing] = useState<Emotion | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  // Dismissing onboarding is component-local: a fresh mount re-offers it while
  // the list is still empty. No persistence needed (per design).
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)

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

  const emotions = data ?? []
  const entity = t('manage.entity_emotions')

  // While empty (and not yet dismissed), the onboarding replaces the standard
  // empty state and the "+ New emotion" button so it is the single focal CTA.
  const showOnboarding =
    !loading && !error && emotions.length === 0 && !onboardingDismissed

  if (showOnboarding) {
    return (
      <EmotionsOnboarding
        onImported={reload}
        onSkip={() => setOnboardingDismissed(true)}
      />
    )
  }

  const filtered = emotions.filter((emotion) => {
    if (nameFilter && !emotion.name.toLowerCase().includes(nameFilter.trim().toLowerCase())) {
      return false
    }
    if (categoryFilter && emotion.category !== categoryFilter) return false
    if (severityFilter && emotion.severity !== severityFilter) return false
    return true
  })

  const filtersActive =
    nameFilter !== '' || categoryFilter !== null || severityFilter !== null
  const reduced = filtersActive && filtered.length < emotions.length

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
        isEmpty={emotions.length === 0}
        emptyMessage={t('settings.emotions.empty')}
        onRetry={reload}
      >
        <Table.ScrollContainer minWidth={600}>
          <Table striped highlightOnHover fz="sm" verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('settings.emotions.columns.name')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('settings.emotions.columns.category')}
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
              <Table.Tr>
                <Table.Th>
                  <TextInput
                    size="xs"
                    placeholder={t('manage.filter_placeholder')}
                    value={nameFilter}
                    onChange={(event) => setNameFilter(event.currentTarget.value)}
                    aria-label={t('settings.emotions.columns.name')}
                  />
                </Table.Th>
                <Table.Th>
                  <Select
                    size="xs"
                    placeholder={t('manage.filter_all')}
                    data={EMOTION_CATEGORIES.map((category) => ({
                      value: category,
                      label: t(CATEGORY_I18N_KEYS[category]),
                    }))}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    clearable
                    aria-label={t('settings.emotions.columns.category')}
                  />
                </Table.Th>
                <Table.Th />
                <Table.Th>
                  <Select
                    size="xs"
                    placeholder={t('manage.filter_all')}
                    data={[...EMOTION_SEVERITIES]}
                    value={severityFilter}
                    onChange={setSeverityFilter}
                    clearable
                    aria-label={t('settings.emotions.columns.severity')}
                  />
                </Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            {filtered.length > 0 && (
              <Table.Tbody>
                {filtered.map((emotion) => (
                  <Table.Tr key={emotion.id}>
                    <Table.Td>{emotion.name}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="indigo">
                        {t(CATEGORY_I18N_KEYS[emotion.category])}
                      </Badge>
                    </Table.Td>
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
            )}
          </Table>
        </Table.ScrollContainer>

        {filtered.length === 0 && <FilterEmptyState />}

        {reduced && filtered.length > 0 && (
          <Text c="dimmed" size="sm" mt="sm">
            {t('manage.showing_count', {
              count: filtered.length,
              total: emotions.length,
              entity,
            })}
          </Text>
        )}
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
