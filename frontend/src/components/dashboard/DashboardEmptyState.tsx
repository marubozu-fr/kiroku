import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  IconChartBar,
  IconChartLine,
  IconLayoutDashboard,
  IconList,
  IconPlus,
} from '@tabler/icons-react'
import { Button, Card, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core'

/**
 * Shown when the dashboard has no trades yet. A centered welcome card with a
 * three-item feature preview and a CTA to the trade form, per the issue-72
 * mockup ("Empty-state decision").
 */
export function DashboardEmptyState() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const features = [
    {
      icon: <IconChartBar size={24} />,
      label: t('dashboard.empty.features.stats_label'),
      desc: t('dashboard.empty.features.stats_desc'),
    },
    {
      icon: <IconChartLine size={24} />,
      label: t('dashboard.empty.features.charts_label'),
      desc: t('dashboard.empty.features.charts_desc'),
    },
    {
      icon: <IconList size={24} />,
      label: t('dashboard.empty.features.activity_label'),
      desc: t('dashboard.empty.features.activity_desc'),
    },
  ]

  return (
    <Card padding="xl" radius="md" withBorder>
      <Stack align="center" gap="md">
        <ThemeIcon size={64} radius="xl" variant="light" color="gray">
          <IconLayoutDashboard size={32} />
        </ThemeIcon>
        <Text fw={600} size="lg">
          {t('dashboard.empty.title')}
        </Text>
        <Text c="dimmed" size="sm" ta="center">
          {t('dashboard.empty.description')}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" w="100%">
          {features.map((feature) => (
            <Paper key={feature.label} withBorder radius="md" p="md">
              <Stack align="center" gap={4}>
                <ThemeIcon size={36} radius="md" variant="light" color="gray">
                  {feature.icon}
                </ThemeIcon>
                <Text fw={500} size="sm" ta="center">
                  {feature.label}
                </Text>
                <Text c="dimmed" size="xs" ta="center">
                  {feature.desc}
                </Text>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
        <Button leftSection={<IconPlus size={20} />} onClick={() => navigate('/journal/new')}>
          {t('dashboard.empty.cta')}
        </Button>
      </Stack>
    </Card>
  )
}
