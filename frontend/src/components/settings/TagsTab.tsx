import { useState } from 'react'
import { IconPencil, IconPlus } from '@tabler/icons-react'
import { ActionIcon, Button, Group, Switch, Table, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { tagsApi } from '@/services/referenceData'
import type { Tag } from '@/types/referenceData'
import { DataStates } from './DataStates'
import { TagModal } from './TagModal'
import { notifyError, notifySuccess } from './notify'

export function TagsTab() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useFetch(tagsApi.list)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

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
      if (tag.is_active) {
        await tagsApi.deactivate(tag.id)
        notifySuccess(t('settings.tags.notify.deactivated', { name: tag.name }))
      } else {
        await tagsApi.update(tag.id, { is_active: true })
        notifySuccess(t('settings.tags.notify.activated', { name: tag.name }))
      }
      reload()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : t('settings.tags.notify.update_error'))
    } finally {
      setTogglingId(null)
    }
  }

  const tags = data ?? []

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
                <Table.Th tt="uppercase" fz="xs" c="dimmed" w={60}>
                  {t('settings.tags.columns.edit')}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tags.map((tag) => (
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
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => openEdit(tag)}
                      aria-label={t('settings.tags.edit_aria', { name: tag.name })}
                    >
                      <IconPencil size={20} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
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
    </>
  )
}
