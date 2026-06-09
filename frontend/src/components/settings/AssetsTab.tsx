import { useState } from 'react'
import { IconPencil, IconPlus } from '@tabler/icons-react'
import { ActionIcon, Badge, Button, Group, Switch, Table, Text } from '@mantine/core'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi } from '@/services/referenceData'
import type { Asset } from '@/types/referenceData'
import { AssetModal } from './AssetModal'
import { DataStates } from './DataStates'
import { notifyError, notifySuccess } from './notify'

export function AssetsTab() {
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
        notifySuccess(`${asset.name} deactivated`)
      } else {
        await assetsApi.update(asset.id, { is_active: true })
        notifySuccess(`${asset.name} activated`)
      }
      reload()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : 'Could not update asset')
    } finally {
      setTogglingId(null)
    }
  }

  const assets = data ?? []

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={20} />} onClick={openAdd}>
          Add asset
        </Button>
      </Group>

      <DataStates
        loading={loading}
        error={error}
        isEmpty={assets.length === 0}
        emptyMessage="No assets yet. Add your first instrument to start journaling trades."
        onRetry={reload}
      >
        <Table.ScrollContainer minWidth={600}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  Name
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  Category
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  Currency
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed">
                  Active
                </Table.Th>
                <Table.Th tt="uppercase" fz="xs" c="dimmed" w={60}>
                  Edit
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
                          ? `Deactivate ${asset.name}`
                          : `Activate ${asset.name}`
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => openEdit(asset)}
                      aria-label={`Edit ${asset.name}`}
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
