import {
  IconChartCandle,
  IconMoodSmile,
  IconSettings,
  IconTags,
} from '@tabler/icons-react'
import { Stack, Tabs, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { AssetsTab } from '@/components/settings/AssetsTab'
import { EmotionsTab } from '@/components/settings/EmotionsTab'
import { GeneralTab } from '@/components/settings/GeneralTab'
import { TagsTab } from '@/components/settings/TagsTab'

export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <Title order={2}>{t('settings.title')}</Title>
      <Tabs defaultValue="general">
        <Tabs.List>
          <Tabs.Tab value="general" leftSection={<IconSettings size={20} />}>
            {t('settings.tabs.general')}
          </Tabs.Tab>
          <Tabs.Tab value="assets" leftSection={<IconChartCandle size={20} />}>
            {t('settings.tabs.assets')}
          </Tabs.Tab>
          <Tabs.Tab value="tags" leftSection={<IconTags size={20} />}>
            {t('settings.tabs.tags')}
          </Tabs.Tab>
          <Tabs.Tab value="emotions" leftSection={<IconMoodSmile size={20} />}>
            {t('settings.tabs.emotions')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="md" keepMounted={false}>
          <GeneralTab />
        </Tabs.Panel>
        <Tabs.Panel value="assets" pt="md" keepMounted={false}>
          <AssetsTab />
        </Tabs.Panel>
        <Tabs.Panel value="tags" pt="md" keepMounted={false}>
          <TagsTab />
        </Tabs.Panel>
        <Tabs.Panel value="emotions" pt="md" keepMounted={false}>
          <EmotionsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
