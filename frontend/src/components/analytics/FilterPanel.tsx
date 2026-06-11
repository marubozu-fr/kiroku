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
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useDisclosure } from '@mantine/hooks'
import dayjs from 'dayjs'
import type { AnalyticsFilters, AvailableFilters } from '@/types/analytics'
import classes from './FilterPanel.module.css'

interface FilterPanelProps {
  availableFilters: AvailableFilters
  filters: AnalyticsFilters
  setFilter: <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => void
  resetFilters: () => void
  activeFilterCount: number
}

export function FilterPanel({
  availableFilters,
  filters,
  setFilter,
  resetFilters,
  activeFilterCount,
}: FilterPanelProps) {
  const { t } = useTranslation()
  const [opened, { toggle }] = useDisclosure(true)

  const assetOptions = availableFilters.assets.map((a) => ({
    value: String(a.id),
    label: a.name,
  }))

  const tagOptions = availableFilters.tags.map((tag) => ({
    value: String(tag.id),
    label: tag.name,
  }))

  const emotionOptions = availableFilters.emotions.map((e) => ({
    value: String(e.id),
    label: e.name,
  }))

  const timeframeOptions = availableFilters.timeframes.map((tf) => ({
    value: tf,
    label: tf,
  }))

  const directionValue = filters.direction ?? ''

  const typesValue =
    filters.types && filters.types.length === 1 ? filters.types[0] : ''

  const operatorOptions = [
    { value: 'gte', label: t('analytics.filters.op_gte') },
    { value: 'lte', label: t('analytics.filters.op_lte') },
  ]

  const durationUnitOptions = [
    { value: 'minutes', label: t('analytics.filters.unit_minutes') },
    { value: 'hours', label: t('analytics.filters.unit_hours') },
    { value: 'days', label: t('analytics.filters.unit_days') },
  ]

  return (
    <Card padding="md" radius="md" withBorder>
      <Stack gap="sm">
        {/* Header row: title + toggle button */}
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm">
            {t('analytics.filters.title')}
          </Text>
          <Group gap="xs" wrap="nowrap">
            {activeFilterCount > 0 && (
              <Button variant="subtle" size="xs" onClick={resetFilters}>
                {t('analytics.filters.reset')}
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
              {t('analytics.filters.toggle')}
            </Button>
          </Group>
        </Group>

        <Collapse in={opened}>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} className={classes.grid}>
            {/* 1. Date from */}
            <DatePickerInput
              label={t('analytics.filters.date_from')}
              placeholder={t('analytics.filters.date_from')}
              value={filters.date_from ? new Date(filters.date_from) : null}
              onChange={(value) => {
                setFilter('date_from', value ? dayjs(value).format('YYYY-MM-DD') : undefined)
              }}
              clearable
              size="xs"
            />

            {/* 2. Date to */}
            <DatePickerInput
              label={t('analytics.filters.date_to')}
              placeholder={t('analytics.filters.date_to')}
              value={filters.date_to ? new Date(filters.date_to) : null}
              onChange={(value) => {
                setFilter('date_to', value ? dayjs(value).format('YYYY-MM-DD') : undefined)
              }}
              clearable
              size="xs"
            />

            {/* 3. Asset */}
            <MultiSelect
              label={t('analytics.filters.asset')}
              placeholder={t('analytics.filters.placeholder_select')}
              data={assetOptions}
              value={filters.asset_ids ? filters.asset_ids.map(String) : []}
              onChange={(values) => {
                const ids = values.map(Number).filter((n) => !isNaN(n))
                setFilter('asset_ids', ids.length > 0 ? ids : undefined)
              }}
              clearable
              size="xs"
            />

            {/* 4. Direction */}
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                {t('analytics.filters.direction')}
              </Text>
              <SegmentedControl
                size="xs"
                value={directionValue}
                onChange={(value) => {
                  setFilter('direction', value === '' ? undefined : value)
                }}
                data={[
                  { value: '', label: t('analytics.filters.direction_all') },
                  { value: 'long', label: t('analytics.filters.direction_long') },
                  { value: 'short', label: t('analytics.filters.direction_short') },
                ]}
              />
            </Stack>

            {/* 5. Entry timeframe */}
            <MultiSelect
              label={t('analytics.filters.entry_tf')}
              placeholder={t('analytics.filters.placeholder_select')}
              data={timeframeOptions}
              value={filters.entry_timeframe ?? []}
              onChange={(values) => {
                setFilter('entry_timeframe', values.length > 0 ? values : undefined)
              }}
              clearable
              size="xs"
            />

            {/* 6. Tags + AND/OR */}
            <Stack gap={4}>
              <MultiSelect
                label={t('analytics.filters.tags')}
                placeholder={t('analytics.filters.placeholder_select')}
                data={tagOptions}
                value={filters.tag_ids ? filters.tag_ids.map(String) : []}
                onChange={(values) => {
                  const ids = values.map(Number).filter((n) => !isNaN(n))
                  setFilter('tag_ids', ids.length > 0 ? ids : undefined)
                }}
                clearable
                size="xs"
              />
              <SegmentedControl
                size="xs"
                value={filters.tags_logic ?? 'AND'}
                onChange={(value) => {
                  if (value === 'AND' || value === 'OR') {
                    setFilter('tags_logic', value)
                  }
                }}
                data={[
                  { value: 'AND', label: t('analytics.filters.logic_and') },
                  { value: 'OR', label: t('analytics.filters.logic_or') },
                ]}
              />
            </Stack>

            {/* 7. Emotions */}
            <MultiSelect
              label={t('analytics.filters.emotions')}
              placeholder={t('analytics.filters.placeholder_select')}
              data={emotionOptions}
              value={filters.emotion_ids ? filters.emotion_ids.map(String) : []}
              onChange={(values) => {
                const ids = values.map(Number).filter((n) => !isNaN(n))
                setFilter('emotion_ids', ids.length > 0 ? ids : undefined)
              }}
              clearable
              size="xs"
            />

            {/* 8. Account type */}
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                {t('analytics.filters.account_type')}
              </Text>
              <SegmentedControl
                size="xs"
                value={typesValue}
                onChange={(value) => {
                  setFilter('types', value === '' ? undefined : [value])
                }}
                data={[
                  { value: '', label: t('analytics.filters.type_all') },
                  { value: 'live', label: t('analytics.filters.type_live') },
                  { value: 'demo', label: t('analytics.filters.type_demo') },
                  { value: 'test', label: t('analytics.filters.type_test') },
                ]}
              />
            </Stack>

            {/* 9. Missed opportunities */}
            <Stack gap={4} justify="flex-end">
              <Text size="xs" c="dimmed">
                {t('analytics.filters.missed')}
              </Text>
              <Switch
                size="sm"
                checked={filters.include_missed === true}
                onChange={(e) => {
                  setFilter('include_missed', e.currentTarget.checked)
                }}
              />
            </Stack>

            {/* 10. P&L range */}
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                {t('analytics.filters.pnl')}
              </Text>
              <Group gap="xs" wrap="nowrap">
                <Select
                  size="xs"
                  data={operatorOptions}
                  value={filters.pnl_operator ?? null}
                  onChange={(value) => {
                    if (value === 'gte' || value === 'lte') {
                      setFilter('pnl_operator', value)
                    } else {
                      setFilter('pnl_operator', undefined)
                    }
                  }}
                  placeholder="≥/≤"
                  style={{ width: 70 }}
                />
                <NumberInput
                  size="xs"
                  value={filters.pnl_value ?? ''}
                  onChange={(value) => {
                    setFilter('pnl_value', value === '' ? undefined : Number(value))
                  }}
                  placeholder="R"
                  style={{ flex: 1 }}
                />
              </Group>
            </Stack>

            {/* 11. Duration */}
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                {t('analytics.filters.duration')}
              </Text>
              <Group gap="xs" wrap="nowrap">
                <Select
                  size="xs"
                  data={operatorOptions}
                  value={filters.duration_operator ?? null}
                  onChange={(value) => {
                    if (value === 'gte' || value === 'lte') {
                      setFilter('duration_operator', value)
                    } else {
                      setFilter('duration_operator', undefined)
                    }
                  }}
                  placeholder="≥/≤"
                  style={{ width: 70 }}
                />
                <NumberInput
                  size="xs"
                  value={filters.duration_value ?? ''}
                  onChange={(value) => {
                    setFilter('duration_value', value === '' ? undefined : Number(value))
                  }}
                  placeholder="0"
                  style={{ flex: 1 }}
                />
                <Select
                  size="xs"
                  data={durationUnitOptions}
                  value={filters.duration_unit ?? 'minutes'}
                  onChange={(value) => {
                    if (value === 'minutes' || value === 'hours' || value === 'days') {
                      setFilter('duration_unit', value)
                    }
                  }}
                  style={{ width: 90 }}
                />
              </Group>
            </Stack>
          </SimpleGrid>
        </Collapse>
      </Stack>
    </Card>
  )
}
