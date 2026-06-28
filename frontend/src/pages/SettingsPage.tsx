import { Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { GeneralTab } from '@/components/settings/GeneralTab'

export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <Stack gap={2}>
        <Title order={2}>{t('settings.title')}</Title>
        <Text c="dimmed">{t('settings.subtitle')}</Text>
      </Stack>
      <GeneralTab />
    </Stack>
  )
}
