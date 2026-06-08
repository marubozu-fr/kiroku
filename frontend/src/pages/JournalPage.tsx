import { Stack, Text, Title } from '@mantine/core'

export function JournalPage() {
  return (
    <Stack gap="md">
      <Title order={2}>Journal</Title>
      <Text c="dimmed">Your trade log will appear here.</Text>
    </Stack>
  )
}
