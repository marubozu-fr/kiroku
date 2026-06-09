import { Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export function ProjectionsPage() {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <Title order={2}>{t('projections.title')}</Title>
      <Text c="dimmed">{t('projections.placeholder')}</Text>
    </Stack>
  )
}
