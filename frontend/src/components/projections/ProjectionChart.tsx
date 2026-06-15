import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Group, Text } from '@mantine/core'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { formatR, signedColor } from '@/components/journal/format'
import type { ActualMonth, GoalResult, ProjectedMonth } from '@/types/projections'
import styles from './ProjectionChart.module.css'

/**
 * Optional comparison fan — the projected months from a selected-asset
 * sub-set, already re-anchored so the fan starts at the same "now" point as
 * the main fan (see offset computation in ProjectionsPage).
 */
export interface ComparisonFan {
  projectedMonths: ProjectedMonth[]
  /** R offset added to each percentile so the fan originates at mainLastActual. */
  offset: number
  label: string
}

interface ProjectionChartProps {
  actualMonths: ActualMonth[]
  projectedMonths: ProjectedMonth[]
  goal: GoalResult | null
  comparison?: ComparisonFan
}

/**
 * Combined chart entry that merges actual and projected data on a shared
 * month axis. The two series are distinguished by which keys are present.
 */
interface ChartEntry {
  month: number
  label: string
  /** Actual cumulative R — only present for actual months */
  actual?: number
  /** P50 median projection — only present for projected months */
  p50?: number
  /** P10–P90 band: [bottom, span] for Recharts Area stacking */
  p10_p90?: [number, number]
  /** P25–P75 band: [bottom, span] for Recharts Area stacking */
  p25_p75?: [number, number]
  /** Raw percentiles for tooltip */
  p10?: number
  p25?: number
  p75?: number
  p90?: number
  /** Comparison (selected-asset) re-anchored percentiles */
  comp_p50?: number
  comp_p10_p90?: [number, number]
  comp_p25_p75?: [number, number]
  comp_p10?: number
  comp_p25?: number
  comp_p75?: number
  comp_p90?: number
  /** True for the last actual month (the "now" point where both series meet) */
  isTransition?: boolean
}

function buildEntries(
  actualMonths: ActualMonth[],
  projectedMonths: ProjectedMonth[],
  comparison?: ComparisonFan,
): ChartEntry[] {
  const entries: ChartEntry[] = []

  for (const am of actualMonths) {
    entries.push({
      month: am.month,
      label: am.label,
      actual: am.cumulative_r,
    })
  }

  // The last actual cumulative R anchors the fan
  const lastActual =
    actualMonths.length > 0
      ? (actualMonths.at(-1)?.cumulative_r ?? 0)
      : 0

  // Mark the transition point on the last actual entry
  const lastEntry = entries.at(-1)
  if (lastEntry != null) {
    lastEntry.isTransition = true
  }

  for (const pm of projectedMonths) {
    // Skip the transition month if it already exists in actual
    const existing = entries.find((e) => e.month === pm.month)
    if (existing) {
      // Annotate with projection data for tooltip — actual dot is still shown
      existing.p10 = pm.p10
      existing.p25 = pm.p25
      existing.p50 = pm.p50
      existing.p75 = pm.p75
      existing.p90 = pm.p90
      existing.p10_p90 = [pm.p10, pm.p90 - pm.p10]
      existing.p25_p75 = [pm.p25, pm.p75 - pm.p25]
      continue
    }

    // Recharts stacked Area expects [base, value] for the range trick.
    // We encode P10–P90 as base=p10, value=(p90-p10) so it spans p10→p90.
    entries.push({
      month: pm.month,
      label: pm.label,
      p50: pm.p50,
      p10_p90: [pm.p10, pm.p90 - pm.p10],
      p25_p75: [pm.p25, pm.p75 - pm.p25],
      p10: pm.p10,
      p25: pm.p25,
      p75: pm.p75,
      p90: pm.p90,
    })
  }

  // Sort by month number
  entries.sort((a, b) => a.month - b.month)

  // Carry forward the actual value into projected months for a continuous line
  // from the last actual point to the fan origin.
  let lastActualValue = lastActual
  for (const entry of entries) {
    if (entry.actual !== undefined) {
      lastActualValue = entry.actual
    }
  }
  void lastActualValue

  // Merge comparison fan data if present.
  // The offset was computed in ProjectionsPage as (mainLastActual - compLastActual),
  // so adding it to every comparison percentile re-bases the comparison fan to
  // originate at the same "now" point as the main fan (TraderPro concept).
  if (comparison) {
    for (const cp of comparison.projectedMonths) {
      const off = comparison.offset
      const p10 = cp.p10 + off
      const p25 = cp.p25 + off
      const p50 = cp.p50 + off
      const p75 = cp.p75 + off
      const p90 = cp.p90 + off

      const existing = entries.find((e) => e.month === cp.month)
      if (existing) {
        existing.comp_p50 = p50
        existing.comp_p10_p90 = [p10, p90 - p10]
        existing.comp_p25_p75 = [p25, p75 - p25]
        existing.comp_p10 = p10
        existing.comp_p25 = p25
        existing.comp_p75 = p75
        existing.comp_p90 = p90
      } else {
        entries.push({
          month: cp.month,
          label: cp.label,
          comp_p50: p50,
          comp_p10_p90: [p10, p90 - p10],
          comp_p25_p75: [p25, p75 - p25],
          comp_p10: p10,
          comp_p25: p25,
          comp_p75: p75,
          comp_p90: p90,
        })
      }
    }
    entries.sort((a, b) => a.month - b.month)
  }

  return entries
}

function makeTooltip(goal: GoalResult | null, comparisonLabel?: string) {
  return function ProjectionTooltip({ active, payload, label }: TooltipContentProps) {
    const { t } = useTranslation()

    if (!active || !payload || payload.length === 0) {
      return null
    }

    const entry = payload[0]?.payload as ChartEntry

    return (
      <div className={styles.tooltip}>
        <Text size="sm" fw={600} mb={4}>
          {String(label)}
        </Text>

        {entry.actual !== undefined && (
          <div className={styles.tooltipRow}>
            <Text size="xs" c="dimmed">
              {t('projections.chart.tooltip.actual')}
            </Text>
            <Text size="xs" ff="monospace" c={signedColor(entry.actual)}>
              {formatR(entry.actual)}
            </Text>
          </div>
        )}

        {entry.p50 !== undefined && (
          <>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed">
                {t('projections.chart.tooltip.p90')}
              </Text>
              <Text size="xs" ff="monospace">
                {formatR(entry.p90 ?? null)}
              </Text>
            </div>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed">
                {t('projections.chart.tooltip.p75')}
              </Text>
              <Text size="xs" ff="monospace">
                {formatR(entry.p75 ?? null)}
              </Text>
            </div>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed" fw={600}>
                {t('projections.chart.tooltip.p50')}
              </Text>
              <Text size="xs" ff="monospace" fw={600} c="blue.4">
                {formatR(entry.p50)}
              </Text>
            </div>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed">
                {t('projections.chart.tooltip.p25')}
              </Text>
              <Text size="xs" ff="monospace">
                {formatR(entry.p25 ?? null)}
              </Text>
            </div>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed">
                {t('projections.chart.tooltip.p10')}
              </Text>
              <Text size="xs" ff="monospace">
                {formatR(entry.p10 ?? null)}
              </Text>
            </div>
          </>
        )}

        {/* Comparison percentiles (selected assets, re-anchored) */}
        {entry.comp_p50 !== undefined && comparisonLabel && (
          <>
            <div className={styles.tooltipSeparator} />
            <Text size="xs" c="violet.4" fw={600} mb={2}>
              {comparisonLabel}
            </Text>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed">
                {t('projections.chart.tooltip.comp_p90')}
              </Text>
              <Text size="xs" ff="monospace">
                {formatR(entry.comp_p90 ?? null)}
              </Text>
            </div>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed">
                {t('projections.chart.tooltip.comp_p75')}
              </Text>
              <Text size="xs" ff="monospace">
                {formatR(entry.comp_p75 ?? null)}
              </Text>
            </div>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed" fw={600}>
                {t('projections.chart.tooltip.comp_p50')}
              </Text>
              <Text size="xs" ff="monospace" fw={600} c="violet.4">
                {formatR(entry.comp_p50)}
              </Text>
            </div>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed">
                {t('projections.chart.tooltip.comp_p25')}
              </Text>
              <Text size="xs" ff="monospace">
                {formatR(entry.comp_p25 ?? null)}
              </Text>
            </div>
            <div className={styles.tooltipRow}>
              <Text size="xs" c="dimmed">
                {t('projections.chart.tooltip.comp_p10')}
              </Text>
              <Text size="xs" ff="monospace">
                {formatR(entry.comp_p10 ?? null)}
              </Text>
            </div>
          </>
        )}

        {goal && (
          <div className={styles.tooltipRow}>
            <Text size="xs" c="dimmed">
              {t('projections.chart.tooltip.goal')}
            </Text>
            <Text size="xs" ff="monospace" c="yellow.5">
              {formatR(goal.target_r)}
            </Text>
          </div>
        )}
      </div>
    )
  }
}

export function ProjectionChart({
  actualMonths,
  projectedMonths,
  goal,
  comparison,
}: ProjectionChartProps) {
  const { t } = useTranslation()

  const entries = useMemo(
    () => buildEntries(actualMonths, projectedMonths, comparison),
    [actualMonths, projectedMonths, comparison],
  )

  const TooltipContent = useMemo(
    () => makeTooltip(goal, comparison?.label),
    [goal, comparison?.label],
  )

  // Find the transition month label for the "now" reference line
  const transitionLabel = useMemo(() => {
    const last = actualMonths[actualMonths.length - 1]
    return last?.label ?? null
  }, [actualMonths])

  return (
    <Card padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Text fw={600}>{t('projections.chart.title')}</Text>
        <Text size="xs" c="dimmed">
          {t('projections.chart.simulations')}
        </Text>
      </Group>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={entries} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <defs>
            {/* Actual line gradient: green above 0, red below */}
            <linearGradient id="projActualStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset="50%" stopColor="var(--mantine-color-green-6)" />
              <stop offset="50%" stopColor="var(--mantine-color-red-6)" />
            </linearGradient>
            <linearGradient id="projActualFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="50%"
                stopColor="var(--mantine-color-green-6)"
                stopOpacity={0.15}
              />
              <stop
                offset="50%"
                stopColor="var(--mantine-color-red-6)"
                stopOpacity={0.15}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--mantine-color-default-border)"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--mantine-color-default-border)' }}
            tickLine={false}
          />

          <YAxis
            tickFormatter={(v: number) => formatR(v)}
            tick={{ fill: 'var(--mantine-color-dimmed)', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            width={64}
          />

          <Tooltip
            content={TooltipContent}
            cursor={{ stroke: 'var(--mantine-color-default-border)' }}
          />

          {/* Zero baseline */}
          <ReferenceLine
            y={0}
            stroke="var(--mantine-color-default-border)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />

          {/* "Now" divider: vertical line at the transition month */}
          {transitionLabel && (
            <ReferenceLine
              x={transitionLabel}
              stroke="var(--mantine-color-dimmed)"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: t('projections.chart.now'),
                position: 'insideTopRight',
                fill: 'var(--mantine-color-dimmed)',
                fontSize: 10,
              }}
            />
          )}

          {/* Goal dashed line */}
          {goal && (
            <ReferenceLine
              y={goal.target_r}
              stroke="var(--mantine-color-yellow-5)"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `${t('projections.chart.goal_label')} ${formatR(goal.target_r)}`,
                position: 'insideTopRight',
                fill: 'var(--mantine-color-yellow-5)',
                fontSize: 10,
              }}
            />
          )}

          {/* P10–P90 outer band (lighter) */}
          <Area
            type="monotone"
            dataKey="p10_p90"
            stroke="none"
            fill="var(--mantine-color-blue-6)"
            fillOpacity={0.1}
            dot={false}
            isAnimationActive={false}
            legendType="none"
            activeDot={false}
          />

          {/* P25–P75 inner band (more saturated) */}
          <Area
            type="monotone"
            dataKey="p25_p75"
            stroke="none"
            fill="var(--mantine-color-blue-6)"
            fillOpacity={0.22}
            dot={false}
            isAnimationActive={false}
            legendType="none"
            activeDot={false}
          />

          {/* P50 median line */}
          <Line
            type="monotone"
            dataKey="p50"
            stroke="var(--mantine-color-blue-5)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />

          {/* Actual cumulative-R line */}
          <Area
            type="monotone"
            dataKey="actual"
            stroke="url(#projActualStroke)"
            strokeWidth={2}
            fill="url(#projActualFill)"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />

          {/* --- Comparison fan (selected assets, violet/grape) --- */}
          {comparison && (
            <>
              {/* Comp P10–P90 outer band */}
              <Area
                type="monotone"
                dataKey="comp_p10_p90"
                stroke="none"
                fill="var(--mantine-color-violet-6)"
                fillOpacity={0.1}
                dot={false}
                isAnimationActive={false}
                legendType="none"
                activeDot={false}
                connectNulls
              />

              {/* Comp P25–P75 inner band */}
              <Area
                type="monotone"
                dataKey="comp_p25_p75"
                stroke="none"
                fill="var(--mantine-color-violet-6)"
                fillOpacity={0.22}
                dot={false}
                isAnimationActive={false}
                legendType="none"
                activeDot={false}
                connectNulls
              />

              {/* Comp P50 median line */}
              <Line
                type="monotone"
                dataKey="comp_p50"
                stroke="var(--mantine-color-violet-5)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <Group gap="md" mt="sm" wrap="wrap" className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendLineActual} />
          <Text size="xs" c="dimmed">
            {t('projections.chart.legend.actual')}
          </Text>
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendLineP50} />
          <Text size="xs" c="dimmed">
            {t('projections.chart.legend.p50')}
          </Text>
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatchInner} />
          <Text size="xs" c="dimmed">
            {t('projections.chart.legend.p25_p75')}
          </Text>
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatchOuter} />
          <Text size="xs" c="dimmed">
            {t('projections.chart.legend.p10_p90')}
          </Text>
        </span>
        {goal && (
          <span className={styles.legendItem}>
            <span className={styles.legendLineGoal} />
            <Text size="xs" c="dimmed">
              {t('projections.chart.legend.goal')} {formatR(goal.target_r)}
            </Text>
          </span>
        )}
        {comparison && (
          <>
            <span className={styles.legendItem}>
              <span className={styles.legendLineCompP50} />
              <Text size="xs" c="dimmed">
                {t('projections.chart.legend.comp_p50', { label: comparison.label })}
              </Text>
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendSwatchCompInner} />
              <Text size="xs" c="dimmed">
                {t('projections.chart.legend.comp_band')}
              </Text>
            </span>
          </>
        )}
      </Group>
    </Card>
  )
}
