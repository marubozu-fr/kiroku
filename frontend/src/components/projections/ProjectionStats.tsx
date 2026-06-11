import { useTranslation } from 'react-i18next'
import { Card, SimpleGrid, Text } from '@mantine/core'
import { formatR, signedColor } from '@/components/journal/format'
import type { GoalResult, ProjectionStats as ProjectionStatsType, RiskResult } from '@/types/projections'
import styles from './ProjectionStats.module.css'

interface ProjectionStatsProps {
  stats: ProjectionStatsType
  goal: GoalResult | null
  risk: RiskResult
}

interface StatCardProps {
  label: string
  value: string
  sub: string
  valueColor?: string
}

function StatCard({ label, value, sub, valueColor }: StatCardProps) {
  return (
    <Card padding="md" radius="md" withBorder className={styles.card}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={500} className={styles.label}>
        {label}
      </Text>
      <Text
        size="xl"
        fw={700}
        ff="monospace"
        c={valueColor}
        className={styles.value}
      >
        {value}
      </Text>
      <Text size="xs" c="dimmed" className={styles.sub}>
        {sub}
      </Text>
    </Card>
  )
}

export function ProjectionStats({ stats, goal, risk }: ProjectionStatsProps) {
  const { t } = useTranslation()

  const winRateColor = stats.win_rate >= 50 ? 'green.6' : 'red.6'

  // Risk of ruin: orange above 5%, otherwise dimmed (neutral — not a money value)
  const ruinColor = risk.ruin_probability > 0.05 ? 'orange' : undefined

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
      {/* 1. Expectancy */}
      <StatCard
        label={t('projections.stats.expectancy')}
        value={formatR(stats.expectancy)}
        sub={t('projections.stats.expectancy_sub')}
        valueColor={signedColor(stats.expectancy)}
      />

      {/* 2. Win Rate */}
      <StatCard
        label={t('projections.stats.win_rate')}
        value={`${stats.win_rate.toFixed(1)}%`}
        sub={t('projections.stats.win_rate_sub', {
          winning: Math.round((stats.win_rate / 100) * stats.total_trades),
          total: stats.total_trades,
        })}
        valueColor={winRateColor}
      />

      {/* 3. Std Deviation — dispersion stat, neutral color */}
      <StatCard
        label={t('projections.stats.std_deviation')}
        value={formatR(stats.std_deviation)}
        sub={t('projections.stats.std_deviation_sub')}
      />

      {/* 4. Goal Probability — shown only when a goal is set */}
      {goal && (
        <StatCard
          label={t('projections.stats.goal_probability')}
          value={`${(goal.probability * 100).toFixed(0)}%`}
          sub={t('projections.stats.goal_probability_sub', {
            target: formatR(goal.target_r),
          })}
        />
      )}

      {/* 5. Risk of Ruin */}
      <StatCard
        label={t('projections.stats.risk_of_ruin')}
        value={`${(risk.ruin_probability * 100).toFixed(1)}%`}
        sub={t('projections.stats.risk_of_ruin_sub')}
        valueColor={ruinColor}
      />
    </SimpleGrid>
  )
}
