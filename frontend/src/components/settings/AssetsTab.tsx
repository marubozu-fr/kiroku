import { useState } from 'react'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { ActionIcon, Badge, Button, Group, Select, Switch, Table, Text, TextInput } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi } from '@/services/referenceData'
import { ASSET_CATEGORIES } from '@/types/referenceData'
import type { Asset } from '@/types/referenceData'
import { AssetModal } from './AssetModal'
import { DataStates } from './DataStates'
import { DeleteEntityModal } from './DeleteEntityModal'
import { FilterEmptyState } from './FilterEmptyState'
import { useDeleteEntity } from './useDeleteEntity'
import { notifyError, notifySuccess } from './notify'

export function AssetsTab() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useFetch(assetsApi.list)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [currencyFilter, setCurrencyFilter] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

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
  const currencies = [...new Set(assets.map((a) => a.currency).filter(Boolean))] as string[]
  const entity = t('manage.entity_assets')

  const filtered = assets.filter((asset) => {
    if (nameFilter && !asset.name.toLowerCase().includes(nameFilter.trim().toLowerCase())) {
      return false
    }
    if (categoryFilter && asset.category !== categoryFilter) return false
    if (currencyFilter && asset.currency !== currencyFilter) return false
    if (activeFilter && (activeFilter === 'yes') !== asset.is_active) return false
    return true
  })

  const filtersActive =
    nameFilter !== '' ||
    categoryFilter !== null ||
    currencyFilter !== null ||
    activeFilter !== null
  const reduced = filtersActive && filtered.length < assets.length

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
              <Table.Tr>
                <Table.Th>
                  <TextInput
                    size="xs"
                    placeholder={t('manage.filter_placeholder')}
                    value={nameFilter}
                    onChange={(event) => setNameFilter(event.currentTarget.value)}
                    aria-label={t('settings.assets.columns.name')}
                  />
                </Table.Th>
                <Table.Th>
                  <Select
                    size="xs"
                    placeholder={t('manage.filter_all')}
                    data={[...ASSET_CATEGORIES]}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    clearable
                    aria-label={t('settings.assets.columns.category')}
                  />
                </Table.Th>
                <Table.Th>
                  <Select
                    size="xs"
                    placeholder={t('manage.filter_all')}
                    data={currencies}
                    value={currencyFilter}
                    onChange={setCurrencyFilter}
                    clearable
                    aria-label={t('settings.assets.columns.currency')}
                  />
                </Table.Th>
                <Table.Th>
                  <Select
                    size="xs"
                    placeholder={t('manage.filter_all')}
                    data={[
                      { value: 'yes', label: t('manage.filter_active_yes') },
                      { value: 'no', label: t('manage.filter_active_no') },
                    ]}
                    value={activeFilter}
                    onChange={setActiveFilter}
                    clearable
                    aria-label={t('settings.assets.columns.active')}
                  />
                </Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            {filtered.length > 0 && (
            <Table.Tbody>
              {filtered.map((asset) => (
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
            )}
          </Table>
        </Table.ScrollContainer>

        {filtered.length === 0 && <FilterEmptyState />}

        {reduced && filtered.length > 0 && (
          <Text c="dimmed" size="sm" mt="sm">
            {t('manage.showing_count', {
              count: filtered.length,
              total: assets.length,
              entity,
            })}
          </Text>
        )}
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
