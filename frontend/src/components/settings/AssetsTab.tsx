import { useState } from 'react'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { ActionIcon, Badge, Button, Group, Switch, Table, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi } from '@/services/referenceData'
import type { Asset } from '@/types/referenceData'
import { AssetModal } from './AssetModal'
import { DataStates } from './DataStates'
import { DeleteEntityModal } from './DeleteEntityModal'
import { useDeleteEntity } from './useDeleteEntity'
import { notifyError, notifySuccess } from './notify'

export function AssetsTab() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useFetch(assetsApi.list)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const del = useDeleteEntity<Asset>({
    countFn: assetsApi.tradeCount,
    deleteFn: assetsApi.remove,
    onDeleted: reload,
    successMessage: (asset) => t('settings.assets.notify.deleted', { name: asset.name }),
    errorMessage: t('settings.assets.notify.delete_error'),
  })

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (asset: Asset) => {
    setEditing(asset)
    setModalOpen(true)
  }

  const toggleActive = async (asset: Asset) => {
    setTogglingId(asset.id)
    try {
      await assetsApi.update(asset.id, { is_active: !asset.is_active })
      notifySuccess(
        asset.is_active
          ? t('settings.assets.notify.deactivated', { name: asset.name })
          : t('settings.assets.notify.activated', { name: asset.name }),
      )
      reload()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : t('settings.assets.notify.update_error'))
    } finally {
      setTogglingId(null)
    }
  }

  const assets = data ?? []

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={20} />} onClick={openAdd}>
          {t('settings.assets.add')}
        </Button>
      </Group>

      <DataStates
        loading={loading}
        error={error}
        isEmpty={assets.length === 0}
        emptyMessage={t('settings.assets.empty')}
        onRetry={reload}
      >
        <Table.ScrollContainer minWidth={600}>
          <Table striped highlightOnHover fz="sm" verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('settings.assets.columns.name')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('settings.assets.columns.category')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('settings.assets.columns.currency')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  {t('settings.assets.columns.active')}
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed" w={100}>
                  {t('settings.assets.columns.actions')}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {assets.map((asset) => (
                <Table.Tr key={asset.id}>
                  <Table.Td>
                    <Text c={asset.is_active ? undefined : 'dimmed'}>{asset.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="gray">
                      {asset.category}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{asset.currency ?? '—'}</Table.Td>
                  <Table.Td>
                    <Switch
                      checked={asset.is_active}
                      disabled={togglingId === asset.id}
                      onChange={() => toggleActive(asset)}
                      aria-label={
                        asset.is_active
                          ? t('settings.assets.deactivate_aria', { name: asset.name })
                          : t('settings.assets.activate_aria', { name: asset.name })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => openEdit(asset)}
                        aria-label={t('settings.assets.edit_aria', { name: asset.name })}
                      >
                        <IconPencil size={20} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => del.open(asset)}
                        aria-label={t('settings.assets.delete.aria', { name: asset.name })}
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
      </DataStates>

      <AssetModal
        opened={modalOpen}
        asset={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          reload()
        }}
      />

      <DeleteEntityModal
        opened={del.target !== null}
        mode="guarded"
        i18nPrefix="settings.assets.delete"
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
