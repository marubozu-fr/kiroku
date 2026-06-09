import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { IconPlus } from '@tabler/icons-react'
import { Button, Group, Select, Stack, Title } from '@mantine/core'
import { TradeTable } from '@/components/journal/TradeTable'
import { useFetch } from '@/hooks/useFetch'
import { assetsApi } from '@/services/referenceData'
import { tradesApi } from '@/services/trades'

/**
 * Main journal page: a year selector over a table of that year's trades.
 *
 * Years with trades come from the API; the current year is always offered so
 * a fresh journal still has a sensible default. The asset name shown per row
 * is resolved client-side from the reference-data assets list.
 */
export function JournalPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const years = useFetch(useCallback((signal: AbortSignal) => tradesApi.years(signal), []))
  const assets = useFetch(assetsApi.list)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(() => {
    const set = new Set<number>(years.data ?? [])
    set.add(currentYear)
    return Array.from(set).sort((a, b) => b - a)
  }, [years.data, currentYear])

  // Fall back to the most recent year until the user picks one.
  const effectiveYear = selectedYear ?? yearOptions[0] ?? null

  const assetName = useCallback(
    (assetId: number | null): string => {
      if (assetId === null) {
        return '—'
      }
      const match = (assets.data ?? []).find((asset) => asset.id === assetId)
      return match?.name ?? '—'
    },
    [assets.data],
  )

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>{t('journal.title')}</Title>
        <Button leftSection={<IconPlus size={20} />} onClick={() => navigate('/journal/new')}>
          {t('journal.add_trade')}
        </Button>
      </Group>

      <Select
        aria-label={t('journal.year')}
        w={120}
        allowDeselect={false}
        data={yearOptions.map(String)}
        value={effectiveYear === null ? null : String(effectiveYear)}
        onChange={(value) => {
          if (value) {
            setSelectedYear(Number(value))
          }
        }}
      />

      {effectiveYear !== null && (
        <TradeTable key={effectiveYear} year={effectiveYear} assetName={assetName} />
      )}
    </Stack>
  )
}
