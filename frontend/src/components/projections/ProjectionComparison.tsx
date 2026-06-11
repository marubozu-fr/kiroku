import { useTranslation } from 'react-i18next'
import { Card, SimpleGrid, Text } from '@mantine/core'
import { formatR, signedColor } from '@/components/journal/format'
import type { ProjectionStats } from '@/types/projections'
import styles from './ProjectionComparison.module.css'

interface ProjectionComparisonProps {
  mainStats: ProjectionStats
  compStats: ProjectionStats
  /** Real projected year-end median (last projected month's p50, anchored to mainLastActual). */
  mainYearEndR: number
  /** Real projected year-end median for the selected assets (re-anchored via compOffset). */
  compYearEndR: number
  /** Comma-joined list of selected asset names, for the explanation note. */
  assetLabel: string
}

interface CompStatRowProps {
  label: string
  allValue: string
  selValue: string
  allColor?: string
  selColor?: string
}

function CompStatRow({ label, allValue, selValue, allColor, selColor }: CompStatRowProps) {
  return (
    <div className={styles.row}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={500} className={styles.rowLabel}>
        {label}
      </Text>
      <div className={styles.rowValues}>
        <Text size="sm" fw={700} ff="monospace" c={allColor}>
          {allValue}
        </Text>
        <Text size="sm" fw={700} ff="monospace" c={selColor}>
          {selValue}
        </Text>
      </div>
    </div>
  )
}

export function ProjectionComparison({
  mainStats,
  compStats,
  mainYearEndR,
  compYearEndR,
  assetLabel,
}: ProjectionComparisonProps) {
  const { t } = useTranslation()

  return (
    <Card padding="md" radius="md" withBorder>
      {/* Column headers */}
      <SimpleGrid cols={2} mb="xs">
        <Text size="xs" c="dimmed" tt="uppercase" fw={500} className={styles.colHeader}>
          {t('projections.comparison.col_all')}
        </Text>
        <Text size="xs" c="violet.5" tt="uppercase" fw={500} className={styles.colHeader}>
          {t('projections.comparison.col_selected')}
        </Text>
      </SimpleGrid>

      <div className={styles.statsBlock}>
        <CompStatRow
          label={t('projections.comparison.expectancy')}
          allValue={formatR(mainStats.expectancy)}
          selValue={formatR(compStats.expectancy)}
          allColor={signedColor(mainStats.expectancy)}
          selColor={signedColor(compStats.expectancy)}
        />
        <CompStatRow
          label={t('projections.comparison.win_rate')}
          allValue={`${mainStats.win_rate.toFixed(1)}%`}
          selValue={`${compStats.win_rate.toFixed(1)}%`}
          allColor={mainStats.win_rate >= 50 ? 'green.6' : 'red.6'}
          selColor={compStats.win_rate >= 50 ? 'green.6' : 'red.6'}
        />
        <CompStatRow
          label={t('projections.comparison.median_end')}
          allValue={formatR(mainYearEndR)}
          selValue={formatR(compYearEndR)}
        />
      </div>

      {/* What-if explanation */}
      <Text size="xs" c="dimmed" mt="sm" className={styles.note}>
        {t('projections.comparison.note', { assets: assetLabel })}
      </Text>
    </Card>
  )
}
