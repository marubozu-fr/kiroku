import { Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import classes from './DashboardPage.module.css'

export function DashboardPage() {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <Title order={2}>{t('dashboard.title')}</Title>
      <div className={classes.placeholder}>
        <Text>{t('dashboard.empty')}</Text>
      </div>
    </Stack>
  )
}
