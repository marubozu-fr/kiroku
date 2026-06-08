import { Stack, Text, Title } from '@mantine/core'

export function SettingsPage() {
  return (
    <Stack gap="md">
      <Title order={2}>Settings</Title>
      <Text c="dimmed">App configuration will appear here.</Text>
    </Stack>
  )
}
