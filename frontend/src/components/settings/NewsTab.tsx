import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  Anchor,
  Card,
  Checkbox,
  Divider,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { newsApi } from '@/services/news'
import { preferencesApi } from '@/services/preferences'
import type { NewsMinImpact, PreferencesUpdate } from '@/types/preferences'
import { DataStates } from './DataStates'
import { notifyError } from './notify'

dayjs.extend(relativeTime)

// Currencies offered in the news filter, per the issue #161 mockup.
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'NZD', 'CNY']

export function NewsTab() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useFetch(preferencesApi.get)
  const status = useFetch(newsApi.status)

  // Local mirror of the persisted preferences so each control can update
  // optimistically and revert on a failed save.
  const [enabled, setEnabled] = useState(false)
  const [currencies, setCurrencies] = useState<string[]>([])
  const [minImpact, setMinImpact] = useState<NewsMinImpact>('MEDIUM')
  const [lastSync, setLastSync] = useState<string | null>(null)

  // Seed the editable mirror from the fetched preferences exactly once, so a
  // later optimistic edit is never clobbered by the same initial response.
  const prefsInit = useRef(false)
  useEffect(() => {
    if (prefsInit.current || !data) {
      return
    }
    prefsInit.current = true
    setEnabled(data.news_enabled)
    setCurrencies(data.news_currencies)
    setMinImpact(data.news_min_impact)
  }, [data])

  const statusInit = useRef(false)
  useEffect(() => {
    if (statusInit.current || !status.data) {
      return
    }
    statusInit.current = true
    setLastSync(status.data.last_sync)
  }, [status.data])

  // Persist a partial update; on failure revert local state and surface a toast.
  const persist = async (update: PreferencesUpdate, revert: () => void) => {
    try {
      await preferencesApi.update(update)
    } catch {
      revert()
      notifyError(t('settings.news.save_error'))
    }
  }

  const handleToggle = (checked: boolean) => {
    const previous = enabled
    setEnabled(checked)
    void persist({ news_enabled: checked }, () => setEnabled(previous))
  }

  const handleCurrencies = (value: string[]) => {
    const previous = currencies
    setCurrencies(value)
    void persist({ news_currencies: value }, () => setCurrencies(previous))
  }

  const handleImpact = (value: string) => {
    const next = value as NewsMinImpact
    const previous = minImpact
    setMinImpact(next)
    void persist({ news_min_impact: next }, () => setMinImpact(previous))
  }

  const impactData = [
    { value: 'HIGH', label: t('settings.news.impact_high') },
    { value: 'MEDIUM', label: t('settings.news.impact_medium') },
    { value: 'LOW', label: t('settings.news.impact_all') },
  ]

  const lastSyncLabel = lastSync
    ? t('settings.news.last_sync', { time: dayjs(lastSync).fromNow() })
    : t('settings.news.never_synced')

  return (
    <DataStates
      loading={loading}
      error={error}
      isEmpty={false}
      emptyMessage=""
      onRetry={reload}
    >
      <Card withBorder padding="md" radius="md" maw={640}>
        <Stack gap="md">
          <Title order={4}>{t('settings.news.title')}</Title>

          <Switch
            checked={enabled}
            onChange={(event) => handleToggle(event.currentTarget.checked)}
            label={t('settings.news.enabled')}
            description={t('settings.news.enabled_description')}
          />

          <Divider />

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fw={500} size="sm">
                {t('settings.news.currencies')}
              </Text>
              <Group gap="xs">
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  disabled={!enabled}
                  onClick={() => handleCurrencies(CURRENCIES)}
                >
                  {t('settings.news.select_all')}
                </Anchor>
                <Text size="sm" c="dimmed">
                  /
                </Text>
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  disabled={!enabled}
                  onClick={() => handleCurrencies([])}
                >
                  {t('settings.news.select_none')}
                </Anchor>
              </Group>
            </Group>
            <Text size="sm" c="dimmed">
              {t('settings.news.currencies_description')}
            </Text>
            <Checkbox.Group value={currencies} onChange={handleCurrencies}>
              <Group gap="md" mt="xs">
                {CURRENCIES.map((code) => (
                  <Checkbox
                    key={code}
                    value={code}
                    disabled={!enabled}
                    label={
                      <Text component="span" ff="monospace">
                        {code}
                      </Text>
                    }
                  />
                ))}
              </Group>
            </Checkbox.Group>
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text fw={500} size="sm">
              {t('settings.news.min_impact')}
            </Text>
            <Text size="sm" c="dimmed">
              {t('settings.news.min_impact_description')}
            </Text>
            <SegmentedControl
              data={impactData}
              value={minImpact}
              onChange={handleImpact}
              disabled={!enabled}
              maw={360}
            />
          </Stack>

          <Divider />

          <Text size="sm" c="dimmed">
            {lastSyncLabel}
          </Text>
        </Stack>
      </Card>
    </DataStates>
  )
}
