import { useTranslation } from 'react-i18next'
import { Card, Group, Text } from '@mantine/core'
import { formatR } from '@/components/journal/format'
import type { GoalResult } from '@/types/projections'
import styles from './GoalProbabilityCard.module.css'

interface GoalProbabilityCardProps {
  goal: GoalResult
}

export function GoalProbabilityCard({ goal }: GoalProbabilityCardProps) {
  const { t } = useTranslation()

  const pct = (goal.probability * 100).toFixed(0)

  return (
    <Card padding="md" radius="md" withBorder className={styles.card}>
      <Group align="center" gap="md" wrap="nowrap">
        <Text
          size="xl"
          fw={700}
          ff="monospace"
          c="yellow.5"
          className={styles.pct}
        >
          {pct}%
        </Text>
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500} className={styles.label}>
            {t('projections.goal_card.label')}
          </Text>
          <Text size="sm" fw={500}>
            {t('projections.goal_card.sentence', {
              pct,
              target: formatR(goal.target_r),
            })}
          </Text>
        </div>
      </Group>
    </Card>
  )
}
