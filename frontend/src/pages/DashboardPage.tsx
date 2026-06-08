import { Stack, Text, Title } from '@mantine/core'
import classes from './DashboardPage.module.css'

export function DashboardPage() {
  return (
    <Stack gap="md">
      <Title order={2}>Dashboard</Title>
      <div className={classes.placeholder}>
        <Text>No data yet — start by logging a trade.</Text>
      </div>
    </Stack>
  )
}
