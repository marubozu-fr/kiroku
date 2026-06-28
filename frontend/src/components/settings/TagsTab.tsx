import { useState } from 'react'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { ActionIcon, Button, Group, Switch, Table, Text, TextInput } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { tagsApi } from '@/services/referenceData'
import type { Tag } from '@/types/referenceData'
import { DataStates } from './DataStates'
import { DeleteEntityModal } from './DeleteEntityModal'
import { FilterEmptyState } from './FilterEmptyState'
import { TagModal } from './TagModal'
import { useDeleteEntity } from './useDeleteEntity'
import { notifyError, notifySuccess } from './notify'

export function TagsTab() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useFetch(tagsApi.list)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [descriptionFilter, setDescriptionFilter] = useState('')

  const del = useDeleteEntity<Tag>({
    countFn: tagsApi.tradeCount,
    deleteFn: tagsApi.remove,
    onDeleted: reload,
    successMessage: (tag) => t('settings.tags.notify.deleted', { name: tag.name }),
    errorMessage: t('settings.tags.notify.delete_error'),
  })

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (tag: Tag) => {
    setEditing(tag)
    setModalOpen(true)
  }

  const toggleActive = async (tag: Tag) => {
    setTogglingId(tag.id)
    try {
      await tagsApi.update(tag.id, { is_active: !tag.is_active })
      notifySuccess(
        tag.is_active
          ? t('settings.tags.notify.deactivated', { name: tag.name })
          : t('settings.tags.notify.activated', { name: tag.name }),
      )
      reload()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : t('settings.tags.notify.update_error'))
    } finally {
      setTogglingId(null)
    }
  }

  const tags = data ?? []
  const entity = t('manage.entity_tags')

  const filtered = tags.filter((tag) => {
    if (nameFilter && !tag.name.toLowerCase().includes(nameFilter.trim().toLowerCase())) {
      return false
    }
    if (
      descriptionFilter &&
      !(tag.description ?? '').toLowerCase().includes(descriptionFilter.trim().toLowerCase())
    ) {
      return false
    }
    return true
  })

  const filtersActive = nameFilter !== '' || descriptionFilter !== ''
  const reduced = filtersActive && filtered.length < tags.length

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={20} />} onClick={openAdd}>
          {t('settings.tags.add')}
        </Button>
      </Group>

      <DataStates
        loading={loading}
        error={error}
        isEmpty={tags.length === 0}
        emptyMessage={t('settings.tags.empty')}
        onRetry={reload}
      >
        <Table.ScrollContainer minWidth={600}>
          <Table striped highlightOnHover fz="sm" verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('settings.tags.columns.name')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('settings.tags.columns.description')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('settings.tags.columns.active')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed" w={100}>
                  {t('settings.tags.columns.actions')}
                </Table.Th>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>
                  <TextInput
                    size="xs"
                    placeholder={t('manage.filter_placeholder')}
                    value={nameFilter}
                    onChange={(event) => setNameFilter(event.currentTarget.value)}
                    aria-label={t('settings.tags.columns.name')}
                  />
                </Table.Th>
                <Table.Th>
                  <TextInput
                    size="xs"
                    placeholder={t('manage.filter_placeholder')}
                    value={descriptionFilter}
                    onChange={(event) => setDescriptionFilter(event.currentTarget.value)}
                    aria-label={t('settings.tags.columns.description')}
                  />
                </Table.Th>
                <Table.Th />
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            {filtered.length > 0 && (
            <Table.Tbody>
              {filtered.map((tag) => (
                <Table.Tr key={tag.id}>
                  <Table.Td>
                    <Text c={tag.is_active ? undefined : 'dimmed'}>{tag.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text c="dimmed" size="sm">
                      {tag.description ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={tag.is_active}
                      disabled={togglingId === tag.id}
                      onChange={() => toggleActive(tag)}
                      aria-label={
                        tag.is_active ? t('settings.tags.deactivate_aria', { name: tag.name }) : t('settings.tags.activate_aria', { name: tag.name })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => openEdit(tag)}
                        aria-label={t('settings.tags.edit_aria', { name: tag.name })}
                      >
                        <IconPencil size={20} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => del.open(tag)}
                        aria-label={t('settings.tags.delete.aria', { name: tag.name })}
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
              total: tags.length,
              entity,
            })}
          </Text>
        )}
      </DataStates>

      <TagModal
        opened={modalOpen}
        tag={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          reload()
        }}
      />

      <DeleteEntityModal
        opened={del.target !== null}
        mode="cascade"
        i18nPrefix="settings.tags.delete"
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
