import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconFilter } from '@tabler/icons-react'
import {
  Badge,
  Button,
  Card,
  Collapse,
  Group,
  MultiSelect,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useDisclosure, useDebouncedValue } from '@mantine/hooks'
import dayjs from 'dayjs'
import { assetsApi } from '@/services/referenceData'
import type { Asset } from '@/types/referenceData'
import type { ProjectionFilters as ProjectionFiltersType } from '@/types/projections'
import { formatAssetLabel } from '@/utils/format'

interface ProjectionFiltersProps {
  filters: ProjectionFiltersType
  onChange: (filters: ProjectionFiltersType) => void
  activeFilterCount: number
}

export function ProjectionFilters({
  filters,
  onChange,
  activeFilterCount,
}: ProjectionFiltersProps) {
  const { t } = useTranslation()
  const [opened, { toggle }] = useDisclosure(true)

  // Local draft state — debounced before calling onChange
  const [draft, setDraft] = useState<ProjectionFiltersType>(filters)
  const [debouncedDraft] = useDebouncedValue(draft, 300)

  // Sync debounced draft up to parent
  useEffect(() => {
    onChange(debouncedDraft)
    // onChange identity changes on every render — only run on draft changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft])

  // Available assets from the reference data endpoint
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([])
  useEffect(() => {
    assetsApi.list().then(setAvailableAssets).catch(() => {})
  }, [])

  const assetOptions = availableAssets.map((a) => ({
    value: a.name,
    label: formatAssetLabel(a.name, a.currency ?? null),
  }))

  function setStartDate(value: Date | null) {
    setDraft((prev) => ({
      ...prev,
      start_date: value ? dayjs(value).format('YYYY-MM-DD') : undefined,
    }))
  }

  function setSelectedAssets(value: string[]) {
    setDraft((prev) => ({
      ...prev,
      assets: value.length > 0 ? value : undefined,
    }))
  }

  function setGoalR(value: string | number) {
    setDraft((prev) => ({
      ...prev,
      goal_r: value === '' ? undefined : Number(value),
    }))
  }

  function reset() {
    const empty: ProjectionFiltersType = {}
    setDraft(empty)
    onChange(empty)
  }

  return (
    <Card padding="md" radius="md" withBorder>
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm">
            {t('projections.filters.title')}
          </Text>
          <Group gap="xs" wrap="nowrap">
            {activeFilterCount > 0 && (
              <Button variant="subtle" size="xs" onClick={reset}>
                {t('projections.filters.reset')}
              </Button>
            )}
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconFilter size={14} />}
              onClick={toggle}
              rightSection={
                activeFilterCount > 0 ? (
                  <Badge size="xs" circle>
                    {activeFilterCount}
                  </Badge>
                ) : undefined
              }
            >
              {t('projections.filters.toggle')}
            </Button>
          </Group>
        </Group>

        <Collapse in={opened}>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {/* Start date */}
            <DatePickerInput
              label={t('projections.filters.start_date')}
              placeholder={t('projections.filters.start_date')}
              value={draft.start_date ? new Date(draft.start_date) : null}
              onChange={setStartDate}
              clearable
              size="xs"
            />

            {/* Assets MultiSelect — spans 2 cols on large */}
            <MultiSelect
              label={t('projections.filters.assets')}
              placeholder={t('projections.filters.assets_placeholder')}
              data={assetOptions}
              value={draft.assets ?? []}
              onChange={setSelectedAssets}
              clearable
              size="xs"
            />

            {/* Goal R */}
            <NumberInput
              label={t('projections.filters.goal_r')}
              placeholder="e.g. 40"
              value={draft.goal_r ?? ''}
              onChange={setGoalR}
              decimalScale={1}
              size="xs"
              ff="monospace"
            />
          </SimpleGrid>
        </Collapse>
      </Stack>
    </Card>
  )
}
