import { Stack, Tabs, Text, Title } from '@mantine/core'
import { IconChartLine, IconDeviceDesktop } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { ChartsTab } from '@/components/settings/ChartsTab'
import { PlatformTab } from '@/components/settings/PlatformTab'

export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <Stack gap={2}>
        <Title order={2}>{t('settings.title')}</Title>
        <Text c="dimmed">{t('settings.subtitle')}</Text>
      </Stack>
      <Tabs defaultValue="platform">
        <Tabs.List>
          <Tabs.Tab value="platform" leftSection={<IconDeviceDesktop size={20} />}>
            {t('settings.tabs.platform')}
          </Tabs.Tab>
          <Tabs.Tab value="charts" leftSection={<IconChartLine size={20} />}>
            {t('settings.tabs.charts')}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="platform" pt="md" keepMounted={false}>
          <PlatformTab />
        </Tabs.Panel>
        <Tabs.Panel value="charts" pt="md" keepMounted={false}>
          <ChartsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
