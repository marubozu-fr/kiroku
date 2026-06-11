import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Center, Text, Tooltip } from '@mantine/core'
import { formatR } from '@/components/journal/format'
import { formatWinRate } from '@/components/dashboard/format'
import type { DayHourCell } from '@/types/analytics'
import styles from './TimeHeatmap.module.css'

interface TimeHeatmapProps {
  data: Record<string, Record<string, DayHourCell>>
}

/** Fixed weekday order matching the backend's English day names. */
const WEEKDAYS: Array<{ english: string; key: string }> = [
  { english: 'Monday', key: 'mon' },
  { english: 'Tuesday', key: 'tue' },
  { english: 'Wednesday', key: 'wed' },
  { english: 'Thursday', key: 'thu' },
  { english: 'Friday', key: 'fri' },
  { english: 'Saturday', key: 'sat' },
  { english: 'Sunday', key: 'sun' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)

/**
 * Compute a per-cell background color from win_rate (0–100).
 * This is data-driven (each cell has a different value), so inline style is
 * used to pass the computed color as the CSS custom property --cell-bg.
 * All other visual decisions live in the CSS module.
 */
function cellColor(cell: DayHourCell | undefined): string {
  if (!cell || cell.total_trades === 0) {
    return 'var(--mantine-color-default-border)'
  }
  const wr = cell.win_rate
  if (wr >= 50) {
    // Green with opacity scaled from 0.15 (50%) to 0.8 (100%)
    const intensity = ((wr - 50) / 50) * 0.65 + 0.15
    return `color-mix(in srgb, var(--mantine-color-green-6) ${Math.round(intensity * 100)}%, transparent)`
  } else {
    // Red with opacity scaled from 0.15 (50%) to 0.8 (0%)
    const intensity = ((50 - wr) / 50) * 0.65 + 0.15
    return `color-mix(in srgb, var(--mantine-color-red-6) ${Math.round(intensity * 100)}%, transparent)`
  }
}

export function TimeHeatmap({ data }: TimeHeatmapProps) {
  const { t } = useTranslation()

  const isEmpty = useMemo(() => Object.keys(data).length === 0, [data])

  return (
    <Card padding="md" radius="md" withBorder>
      <Text fw={600} mb="sm">
        {t('analytics.charts.heatmap.title')}
      </Text>

      {isEmpty && (
        <Center py="md">
          <Text c="dimmed" size="sm">
            {t('analytics.charts.heatmap.empty')}
          </Text>
        </Center>
      )}

      {!isEmpty && (
        <div className={styles.wrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.rowLabel} />
                {HOURS.map((h) => (
                  <th key={h} className={styles.colHeader}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map(({ english, key }) => (
                <tr key={english}>
                  <td className={styles.rowLabel}>
                    {t(`common.days.${key}`)}
                  </td>
                  {HOURS.map((h) => {
                    const cell = data[english]?.[String(h)]
                    const bg = cellColor(cell)
                    const tooltipLabel = cell && cell.total_trades > 0
                      ? [
                          `${t('analytics.charts.heatmap.tooltip.trades')}: ${String(cell.total_trades)}`,
                          `${t('analytics.charts.heatmap.tooltip.win_rate')}: ${formatWinRate(cell.win_rate)}`,
                          `${t('analytics.charts.heatmap.tooltip.pnl')}: ${formatR(cell.total_pnl)}`,
                        ].join('\n')
                      : undefined
                    return (
                      <Tooltip
                        key={h}
                        label={tooltipLabel}
                        disabled={!tooltipLabel}
                        multiline
                        withArrow
                      >
                        {/* style here passes only the computed bg color — a data value, not a design decision */}
                        <td
                          className={styles.cell}
                          style={{ '--cell-bg': bg } as React.CSSProperties}
                        />
                      </Tooltip>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
