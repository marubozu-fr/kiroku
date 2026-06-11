import { useTranslation } from 'react-i18next'
import { IconChartLine, IconScale, IconSum } from '@tabler/icons-react'
import { Button, Card, Center, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import styles from './ProjectionEmptyState.module.css'

export function ProjectionEmptyState() {
  const { t } = useTranslation()

  return (
    <Stack gap="lg">
      {/* Main empty state card */}
      <Center>
        <Card padding="xl" radius="md" withBorder style={{ maxWidth: 480, width: '100%' }}>
          <Stack align="center" gap="sm">
            <IconChartLine size={48} stroke={1.2} />
            <Title order={4}>{t('projections.empty.title')}</Title>
            <Text c="dimmed" ta="center" size="sm">
              {t('projections.empty.description')}
            </Text>
            <Button
              component={Link}
              to="/journal/new"
              variant="filled"
              mt="xs"
            >
              {t('projections.empty.cta')}
            </Button>
          </Stack>
        </Card>
      </Center>

      {/* Feature-preview section */}
      <Text size="xs" tt="uppercase" c="dimmed" fw={500} className={styles.sectionLabel}>
        {t('projections.empty.preview_label')}
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {/* Preview 1: fan chart */}
        <Card padding="md" radius="md" withBorder className={styles.previewCard}>
          <div className={styles.previewArt} aria-hidden>
            <svg viewBox="0 0 240 70" preserveAspectRatio="none">
              <line
                x1="0"
                y1="58"
                x2="240"
                y2="58"
                stroke="var(--mantine-color-default-border)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="22"
                x2="240"
                y2="22"
                stroke="var(--mantine-color-yellow-5)"
                strokeWidth="1"
                strokeDasharray="5 3"
              />
              <path
                d="M 120,40 150,30 180,20 210,12 240,6 L 240,52 210,46 180,42 150,42 120,40 Z"
                fill="var(--mantine-color-blue-6)"
                fillOpacity="0.1"
              />
              <path
                d="M 120,40 150,34 180,28 210,22 240,18 L 240,44 210,40 180,38 150,40 120,40 Z"
                fill="var(--mantine-color-blue-6)"
                fillOpacity="0.22"
              />
              <polyline
                points="120,40 150,37 180,33 210,30 240,26"
                fill="none"
                stroke="var(--mantine-color-blue-5)"
                strokeWidth="2"
              />
              <polyline
                points="0,56 30,50 60,52 90,46 120,40"
                fill="none"
                stroke="var(--mantine-color-green-6)"
                strokeWidth="2"
              />
            </svg>
          </div>
          <Text fw={600} size="sm" mt="xs">
            {t('projections.empty.preview.fan_chart.title')}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {t('projections.empty.preview.fan_chart.description')}
          </Text>
        </Card>

        {/* Preview 2: goal & ruin */}
        <Card padding="md" radius="md" withBorder className={styles.previewCard}>
          <Center className={styles.previewIcon}>
            <IconScale size={40} stroke={1.2} />
          </Center>
          <Text fw={600} size="sm" mt="xs">
            {t('projections.empty.preview.goal_ruin.title')}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {t('projections.empty.preview.goal_ruin.description')}
          </Text>
        </Card>

        {/* Preview 3: edge stats */}
        <Card padding="md" radius="md" withBorder className={styles.previewCard}>
          <Center className={styles.previewIcon}>
            <IconSum size={40} stroke={1.2} />
          </Center>
          <Text fw={600} size="sm" mt="xs">
            {t('projections.empty.preview.edge_stats.title')}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {t('projections.empty.preview.edge_stats.description')}
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
