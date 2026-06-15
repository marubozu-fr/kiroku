import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Center, Text } from '@mantine/core'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { formatWinRate } from '@/components/dashboard/format'
import type { RDistributionBucket } from '@/types/analytics'
import styles from './RDistribution.module.css'

interface RDistributionProps {
  data: RDistributionBucket[]
}

/** Internal shape with a computed bar fill added. */
interface BucketEntry extends RDistributionBucket {
  fill: string
}

function buildEntries(data: RDistributionBucket[]): BucketEntry[] {
  return data.map((bucket) => {
    // Negative bucket: max is not null and max <= 0
    // Positive bucket: min is not null and min >= 0
    const isNegative = bucket.max !== null && bucket.max <= 0
    const fill = isNegative
      ? 'var(--mantine-color-red-6)'
      : 'var(--mantine-color-green-6)'
    return { ...bucket, fill }
  })
}

function makeTooltip(totalTrades: number) {
  return function RDistributionTooltip({ active, payload }: TooltipContentProps) {
    const { t } = useTranslation()

    if (!active || !payload || payload.length === 0) {
      return null
    }

    const entry = payload[0]?.payload as BucketEntry
    const pct = totalTrades > 0 ? (entry.count / totalTrades) * 100 : 0

    return (
      <div className={styles.tooltip}>
        <Text size="sm" fw={600} ff="monospace">
          {entry.bucket}
        </Text>
        <div className={styles.tooltipRow}>
          <Text size="xs" c="dimmed">
            {t('analytics.charts.r_distribution.tooltip.trades')}
          </Text>
          <Text size="xs" ff="monospace">
            {String(entry.count)}
          </Text>
        </div>
        <div className={styles.tooltipRow}>
          <Text size="xs" c="dimmed">
            {t('analytics.charts.r_distribution.tooltip.percentage')}
          </Text>
          <Text size="xs" ff="monospace">
            {formatWinRate(pct)}
          </Text>
        </div>
      </div>
    )
  }
}

export function RDistribution({ data }: RDistributionProps) {
  const { t } = useTranslation()

  const totalTrades = useMemo(
    () => data.reduce((sum, b) => sum + b.count, 0),
    [data],
  )

  const entries = useMemo(() => buildEntries(data), [data])

  const TooltipContent = useMemo(() => makeTooltip(totalTrades), [totalTrades])

  const isEmpty = totalTrades === 0

  return (
    <Card padding="md" radius="md" withBorder>
      <Text fw={600} mb="sm">
        {t('analytics.charts.r_distribution.title')}
      </Text>

      {isEmpty && (
        <Center py="md">
          <Text c="dimmed" size="sm">
            {t('analytics.charts.r_distribution.empty')}
          </Text>
        </Center>
      )}

      {!isEmpty && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={entries}
            margin={{ top: 4, right: 16, left: 8, bottom: 40 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--mantine-color-default-border)"
              vertical={false}
            />
            <XAxis
              dataKey="bucket"
              tick={{
                fill: 'var(--mantine-color-dimmed)',
                fontSize: 10,
              }}
              axisLine={{ stroke: 'var(--mantine-color-default-border)' }}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              interval={0}
              label={{
                value: t('analytics.charts.r_distribution.x_axis'),
                position: 'insideBottom',
                offset: -30,
                fill: 'var(--mantine-color-dimmed)',
                fontSize: 11,
              }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: t('analytics.charts.r_distribution.y_axis'),
                angle: -90,
                position: 'insideLeft',
                fill: 'var(--mantine-color-dimmed)',
                fontSize: 11,
              }}
            />
            <Tooltip
              content={TooltipContent}
              cursor={{ fill: 'var(--mantine-color-default-hover)' }}
            />
            {/*
              ReferenceLine at the "0.0 to 0.5" bucket — the first positive
              bucket — to mark the 0R boundary on the categorical X axis.
            */}
            <ReferenceLine
              x="0.0 to 0.5"
              stroke="var(--mantine-color-default-border)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
            {/* Per-bar fill comes from each entry's `fill` field */}
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
