import { IconChartCandle, IconMoodSmile, IconNews, IconTags } from '@tabler/icons-react'
import { Stack, Tabs, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { AssetsTab } from '@/components/settings/AssetsTab'
import { EmotionsTab } from '@/components/settings/EmotionsTab'
import { NewsTab } from '@/components/settings/NewsTab'
import { TagsTab } from '@/components/settings/TagsTab'

export function ManagePage() {
  const { t } = useTranslation()
  return (
    <Stack gap="md">
      <Stack gap={2}>
        <Title order={2}>{t('manage.title')}</Title>
        <Text c="dimmed">{t('manage.subtitle')}</Text>
      </Stack>
      <Tabs defaultValue="assets">
        <Tabs.List>
          <Tabs.Tab value="assets" leftSection={<IconChartCandle size={20} />}>
            {t('manage.tabs.assets')}
          </Tabs.Tab>
          <Tabs.Tab value="tags" leftSection={<IconTags size={20} />}>
            {t('manage.tabs.tags')}
          </Tabs.Tab>
          <Tabs.Tab value="emotions" leftSection={<IconMoodSmile size={20} />}>
            {t('manage.tabs.emotions')}
          </Tabs.Tab>
          <Tabs.Tab value="news" leftSection={<IconNews size={20} />}>
            {t('manage.tabs.news')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="assets" pt="md" keepMounted={false}>
          <AssetsTab />
        </Tabs.Panel>
        <Tabs.Panel value="tags" pt="md" keepMounted={false}>
          <TagsTab />
        </Tabs.Panel>
        <Tabs.Panel value="emotions" pt="md" keepMounted={false}>
          <EmotionsTab />
        </Tabs.Panel>
        <Tabs.Panel value="news" pt="md" keepMounted={false}>
          <NewsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
