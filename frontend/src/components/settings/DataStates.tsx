import { IconAlertTriangle } from '@tabler/icons-react'
import { Alert, Button, Center, Skeleton, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

interface DataStatesProps {
  loading: boolean
  error: string | null
  isEmpty: boolean
  emptyMessage: string
  onRetry: () => void
  children: ReactNode
}

/**
 * Renders the loading / error / empty states shared by every Settings tab,
 * falling through to `children` only when data is present.
 */
export function DataStates({
  loading,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  children,
}: DataStatesProps) {
  if (loading) {
    return (
      <Stack gap="xs">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} height={36} radius="sm" />
        ))}
      </Stack>
    )
  }

  if (error) {
    return (
      <Alert
        color="orange"
        icon={<IconAlertTriangle size={20} />}
        title="Could not load data"
      >
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{error}</Text>
          <Button variant="default" size="xs" onClick={onRetry}>
            Retry
          </Button>
        </Stack>
      </Alert>
    )
  }

  if (isEmpty) {
    return (
      <Center mih={120}>
        <Text c="dimmed" size="sm" ta="center">
          {emptyMessage}
        </Text>
      </Center>
    )
  }

  return <>{children}</>
}
