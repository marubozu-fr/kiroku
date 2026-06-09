import { IconChartCandle, IconMoodSmile, IconTags } from '@tabler/icons-react'
import { Stack, Tabs, Title } from '@mantine/core'
import { AssetsTab } from '@/components/settings/AssetsTab'
import { EmotionsTab } from '@/components/settings/EmotionsTab'
import { TagsTab } from '@/components/settings/TagsTab'

export function SettingsPage() {
  return (
    <Stack gap="md">
      <Title order={2}>Settings</Title>
      <Tabs defaultValue="assets">
        <Tabs.List>
          <Tabs.Tab value="assets" leftSection={<IconChartCandle size={20} />}>
            Assets
          </Tabs.Tab>
          <Tabs.Tab value="tags" leftSection={<IconTags size={20} />}>
            Tags
          </Tabs.Tab>
          <Tabs.Tab value="emotions" leftSection={<IconMoodSmile size={20} />}>
            Emotions
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
      </Tabs>
    </Stack>
  )
}
