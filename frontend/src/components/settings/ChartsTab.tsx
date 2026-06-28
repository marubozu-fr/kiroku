import { useEffect, useRef, useState } from 'react'
import {
  Anchor,
  Button,
  Card,
  Group,
  PasswordInput,
  Stack,
  Title,
} from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { massiveApi } from '@/services/massive'
import { preferencesApi } from '@/services/preferences'
import { ChartTimeframesCard } from './ChartTimeframesCard'
import { notifyError, notifySuccess, notifyWarning } from './notify'

/** Massive sign-up page linked beneath the API key field. */
const MASSIVE_SIGNUP_URL = 'https://massive.com/dashboard/signup'

export function ChartsTab() {
  const { t } = useTranslation()
  const { data } = useFetch(preferencesApi.get)

  const [apiKey, setApiKey] = useState('')
  const [savingApiKey, setSavingApiKey] = useState(false)

  // Seed the editable mirror from the fetched preferences exactly once.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !data) {
      return
    }
    seeded.current = true
    setApiKey(data.massive_api_key)
  }, [data])

  const handleSaveApiKey = async () => {
    setSavingApiKey(true)
    const next = apiKey.trim()
    try {
      await preferencesApi.update({ massive_api_key: next })
      if (next === '') {
        // Key cleared — nothing to validate.
        return
      }
      // The backend reads the key from the just-saved preferences, so validate
      // only after persisting. The search endpoint swallows upstream errors and
      // returns an empty list, so a non-empty result means the key works; an
      // empty or failed response is reported as unverified.
      try {
        const results = await massiveApi.searchTickers('EUR')
        if (results.length > 0) {
          notifySuccess(t('settings.general.massive_api_key_valid'))
        } else {
          notifyWarning(t('settings.general.massive_api_key_invalid'))
        }
      } catch {
        notifyWarning(t('settings.general.massive_api_key_invalid'))
      }
    } catch {
      notifyError(t('settings.general.save_error'))
    } finally {
      setSavingApiKey(false)
    }
  }

  return (
    <Stack gap="md" maw={520}>
      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Title order={4}>{t('settings.charts.data_provider_title')}</Title>
          <PasswordInput
            label={t('settings.general.massive_api_key_label')}
            description={t('settings.general.massive_api_key_hint')}
            value={apiKey}
            onChange={(event) => setApiKey(event.currentTarget.value)}
          />
          <Anchor href={MASSIVE_SIGNUP_URL} target="_blank" rel="noopener noreferrer" fz="sm">
            {t('settings.general.massive_api_key_link')}
          </Anchor>
          <Group mt="xs">
            <Button
              variant="light"
              size="xs"
              loading={savingApiKey}
              onClick={() => void handleSaveApiKey()}
            >
              {t('common.actions.save')}
            </Button>
          </Group>
        </Stack>
      </Card>

      <ChartTimeframesCard />
    </Stack>
  )
}
