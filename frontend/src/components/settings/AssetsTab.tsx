import { useState } from 'react'
import { IconPencil, IconPlus } from '@tabler/icons-react'
import { ActionIcon, Badge, Button, Group, Switch, Table, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi } from '@/services/referenceData'
import type { Asset } from '@/types/referenceData'
import { AssetModal } from './AssetModal'
import { DataStates } from './DataStates'
import { notifyError, notifySuccess } from './notify'

export function AssetsTab() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useFetch(assetsApi.list)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

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
      if (asset.is_active) {
        await assetsApi.deactivate(asset.id)
        notifySuccess(t('settings.assets.notify.deactivated', { name: asset.name }))
      } else {
        await assetsApi.update(asset.id, { is_active: true })
        notifySuccess(t('settings.assets.notify.activated', { name: asset.name }))
      }
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
                <Table.Th tt="uppercase" fz="xs" c="dimmed" w={60}>
                  {t('settings.assets.columns.edit')}
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
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => openEdit(asset)}
                      aria-label={t('settings.assets.edit_aria', { name: asset.name })}
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

      <AssetModal
        opened={modalOpen}
        asset={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          reload()
        }}
      />
    </>
  )
}
