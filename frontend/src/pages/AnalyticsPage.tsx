import { Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export function AnalyticsPage() {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <Title order={2}>{t('analytics.title')}</Title>
      <Text c="dimmed">{t('analytics.placeholder')}</Text>
    </Stack>
  )
}
