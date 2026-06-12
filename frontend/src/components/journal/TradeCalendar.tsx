import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
} from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import dayjs, { type Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import type { TradeSummary } from '@/types/trade'
import { formatR } from './format'
import {
  buildCalendarCells,
  defaultDisplayMonth,
  groupByDate,
  lastVisibleDayOfMonth,
  monthlyReviewSum,
  weeklyReviewSums,
} from './calendar'
import classes from './TradeCalendar.module.css'

dayjs.extend(isoWeek)

interface TradeCalendarProps {
  trades: TradeSummary[]
  assetName: (id: number | null) => string
  selectedYear: number
}

const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

/** Returns the CSS class for a review band based on the signed value. */
function reviewClass(value: number): string {
  if (value > 0) return classes.reviewProfit
  if (value < 0) return classes.reviewLoss
  return classes.reviewNeutral
}

/** Returns the CSS class for a trade event based on performance_r. */
function eventClass(performanceR: number | null): string {
  if (performanceR === null || performanceR === 0) return classes.eventNeutral
  return performanceR > 0 ? classes.eventProfit : classes.eventLoss
}

/**
 * A single trade event pill — used in both the desktop grid and mobile agenda.
 */
interface TradeEventProps {
  trade: TradeSummary
  assetName: (id: number | null) => string
  extraClass?: string
}

function TradeEvent({ trade, assetName, extraClass }: TradeEventProps) {
  const time =
    trade.trade_date ? dayjs(trade.trade_date).format('HH:mm') : '—'
  const label = `${time} ${assetName(trade.asset_id)}: ${formatR(trade.performance_r)}`

  return (
    <Link
      to={`/journal/${trade.id}`}
      className={`${classes.event} ${eventClass(trade.performance_r)} ${extraClass ?? ''}`}
      title={label}
    >
      {label}
    </Link>
  )
}

/**
 * A weekly review band shown at the bottom of the Friday cell.
 */
interface WeeklyReviewBandProps {
  sum: number
  label: string
}

function WeeklyReviewBand({ sum, label }: WeeklyReviewBandProps) {
  return (
    <div className={`${classes.weeklyReview} ${reviewClass(sum)}`}>
      {label}: {formatR(sum)}
    </div>
  )
}

/**
 * A monthly review band shown at the bottom of the last trading day cell.
 */
interface MonthlyReviewBandProps {
  sum: number
  label: string
}

function MonthlyReviewBand({ sum, label }: MonthlyReviewBandProps) {
  return (
    <div className={`${classes.monthlyReview} ${reviewClass(sum)}`}>
      {label}: {formatR(sum)}
    </div>
  )
}

/**
 * Custom trading calendar — Mon–Fri grid with trade events, weekly and
 * monthly review bands.
 *
 * No external calendar library is used. The grid is CSS `grid-template-columns:
 * repeat(5, 1fr)`.
 */
export function TradeCalendar({ trades, assetName, selectedYear }: TradeCalendarProps) {
  const { t } = useTranslation()

  const [displayMonth, setDisplayMonth] = useState<Dayjs>(() =>
    defaultDisplayMonth(trades, selectedYear),
  )

  const currentYear = dayjs().year()
  const currentMonth = dayjs().startOf('month')

  const prevDisabled = displayMonth.month() === 0
  const nextDisabled =
    displayMonth.month() === 11 ||
    (selectedYear === currentYear && displayMonth.isSame(currentMonth, 'month'))

  const showToday =
    selectedYear === currentYear && !displayMonth.isSame(currentMonth, 'month')

  const cells = useMemo(() => buildCalendarCells(displayMonth), [displayMonth])
  const byDate = useMemo(() => groupByDate(trades), [trades])
  const weeklySums = useMemo(() => weeklyReviewSums(trades), [trades])
  const monthSum = useMemo(
    () => monthlyReviewSum(trades, displayMonth),
    [trades, displayMonth],
  )
  const lastTradingDay = useMemo(
    () => lastVisibleDayOfMonth(displayMonth),
    [displayMonth],
  )

  const todayStr = dayjs().format('YYYY-MM-DD')

  function prevMonth() {
    if (!prevDisabled) {
      setDisplayMonth((m) => m.subtract(1, 'month'))
    }
  }

  function nextMonth() {
    if (!nextDisabled) {
      setDisplayMonth((m) => m.add(1, 'month'))
    }
  }

  function goToToday() {
    setDisplayMonth(currentMonth)
  }

  return (
    <>
      {/* Desktop grid */}
      <Box visibleFrom="sm">
        <CalendarHeader
          displayMonth={displayMonth}
          onPrev={prevMonth}
          onNext={nextMonth}
          prevLabel={t('journal.calendar.prev_month')}
          nextLabel={t('journal.calendar.next_month')}
          prevDisabled={prevDisabled}
          nextDisabled={nextDisabled}
          showToday={showToday}
          onToday={goToToday}
          todayLabel={t('journal.calendar.today')}
        />

        {/* Weekday header row */}
        <div className={classes.weekdayHeader}>
          {WEEKDAY_KEYS.map((day) => (
            <Text
              key={day}
              size="xs"
              c="dimmed"
              tt="uppercase"
              className={classes.weekdayLabel}
            >
              {day}
            </Text>
          ))}
        </div>

        {/* Day cells */}
        <div className={classes.grid}>
          {cells.map((cell) => {
            const dateStr = cell.date.format('YYYY-MM-DD')
            const dayTrades = byDate[dateStr] ?? []
            const isFriday = cell.date.day() === 5
            const isToday = dateStr === todayStr
            const weekSumForFriday = isFriday ? weeklySums[dateStr] : undefined
            const isLastTradingDay = dateStr === lastTradingDay

            return (
              <DayCell
                key={dateStr}
                dayNumber={cell.date.date()}
                inCurrentMonth={cell.inCurrentMonth}
                isToday={isToday}
                trades={dayTrades}
                assetName={assetName}
                weeklySum={
                  weekSumForFriday !== undefined && cell.inCurrentMonth
                    ? weekSumForFriday
                    : undefined
                }
                monthlySum={isLastTradingDay ? monthSum : undefined}
                weeklyReviewLabel={t('journal.calendar.weekly_review')}
                monthlyReviewLabel={t('journal.calendar.monthly_review')}
              />
            )
          })}
        </div>
      </Box>

      {/* Mobile agenda */}
      <Box hiddenFrom="sm">
        <CalendarHeader
          displayMonth={displayMonth}
          onPrev={prevMonth}
          onNext={nextMonth}
          prevLabel={t('journal.calendar.prev_month')}
          nextLabel={t('journal.calendar.next_month')}
          prevDisabled={prevDisabled}
          nextDisabled={nextDisabled}
          showToday={showToday}
          onToday={goToToday}
          todayLabel={t('journal.calendar.today')}
        />
        <AgendaView
          trades={trades}
          byDate={byDate}
          displayMonth={displayMonth}
          weeklySums={weeklySums}
          monthSum={monthSum}
          lastTradingDay={lastTradingDay}
          assetName={assetName}
          weeklyReviewLabel={t('journal.calendar.weekly_review')}
          monthlyReviewLabel={t('journal.calendar.monthly_review')}
        />
      </Box>
    </>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

interface CalendarHeaderProps {
  displayMonth: Dayjs
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
  prevDisabled: boolean
  nextDisabled: boolean
  showToday: boolean
  onToday: () => void
  todayLabel: string
}

function CalendarHeader({
  displayMonth,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  prevDisabled,
  nextDisabled,
  showToday,
  onToday,
  todayLabel,
}: CalendarHeaderProps) {
  return (
    <Group justify="space-between" className={classes.header}>
      <ActionIcon variant="default" onClick={onPrev} aria-label={prevLabel} disabled={prevDisabled}>
        <IconChevronLeft size={16} />
      </ActionIcon>
      <Group gap="xs">
        <Text fw={700}>{displayMonth.format('MMMM YYYY')}</Text>
        {showToday && (
          <Button variant="subtle" size="xs" onClick={onToday}>
            {todayLabel}
          </Button>
        )}
      </Group>
      <ActionIcon variant="default" onClick={onNext} aria-label={nextLabel} disabled={nextDisabled}>
        <IconChevronRight size={16} />
      </ActionIcon>
    </Group>
  )
}

interface DayCellProps {
  dayNumber: number
  inCurrentMonth: boolean
  isToday: boolean
  trades: TradeSummary[]
  assetName: (id: number | null) => string
  weeklySum?: number
  monthlySum?: number
  weeklyReviewLabel: string
  monthlyReviewLabel: string
}

const MAX_VISIBLE_EVENTS = 2

function DayCell({
  dayNumber,
  inCurrentMonth,
  isToday,
  trades,
  assetName,
  weeklySum,
  monthlySum,
  weeklyReviewLabel,
  monthlyReviewLabel,
}: DayCellProps) {
  const { t } = useTranslation()
  const visible = trades.slice(0, MAX_VISIBLE_EVENTS)
  const overflow = trades.length - MAX_VISIBLE_EVENTS

  const cellClasses = [
    classes.cell,
    !inCurrentMonth ? classes.cellOutside : '',
    isToday ? classes.cellToday : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Paper withBorder p="xs" className={cellClasses}>
      <Text size="xs" c="dimmed" className={classes.dayNumber}>
        {dayNumber}
      </Text>

      {visible.map((trade) => (
        <TradeEvent key={trade.id} trade={trade} assetName={assetName} />
      ))}

      {overflow > 0 && (
        <Text size="xs" c="dimmed" className={classes.moreText}>
          {t('journal.calendar.more', { count: overflow })}
        </Text>
      )}

      {weeklySum !== undefined && (
        <WeeklyReviewBand sum={weeklySum} label={weeklyReviewLabel} />
      )}

      {monthlySum !== undefined && (
        <MonthlyReviewBand sum={monthlySum} label={monthlyReviewLabel} />
      )}
    </Paper>
  )
}

interface AgendaViewProps {
  trades: TradeSummary[]
  byDate: Record<string, TradeSummary[]>
  displayMonth: Dayjs
  weeklySums: Record<string, number>
  monthSum: number | null
  lastTradingDay: string | null
  assetName: (id: number | null) => string
  weeklyReviewLabel: string
  monthlyReviewLabel: string
}

/**
 * Mobile agenda: lists only days that have activity, in chronological order,
 * with trade events and review bands.
 */
function AgendaView({
  byDate,
  displayMonth,
  weeklySums,
  monthSum,
  lastTradingDay,
  assetName,
  weeklyReviewLabel,
  monthlyReviewLabel,
}: AgendaViewProps) {
  // Collect all active dates (have trades or a review) within the displayed month.
  const activeDates = useMemo(() => {
    const dateSet = new Set<string>()
    for (const dateStr of Object.keys(byDate)) {
      const d = dayjs(dateStr)
      if (d.year() === displayMonth.year() && d.month() === displayMonth.month()) {
        dateSet.add(dateStr)
      }
    }
    // Also include Fridays that have a weekly sum in this month.
    for (const fridayStr of Object.keys(weeklySums)) {
      const d = dayjs(fridayStr)
      if (d.year() === displayMonth.year() && d.month() === displayMonth.month()) {
        dateSet.add(fridayStr)
      }
    }
    if (lastTradingDay) {
      dateSet.add(lastTradingDay)
    }
    return Array.from(dateSet).sort()
  }, [byDate, displayMonth, weeklySums, lastTradingDay])

  if (activeDates.length === 0) {
    return null
  }

  return (
    <Stack gap="sm">
      {activeDates.map((dateStr) => {
        const d = dayjs(dateStr)
        const dayTrades = byDate[dateStr] ?? []
        const isFriday = d.day() === 5
        const weeklySum = isFriday ? weeklySums[dateStr] : undefined
        const isLastTradingDay = dateStr === lastTradingDay

        return (
          <div key={dateStr} className={classes.agendaDay}>
            <Text size="sm" fw={600} c="dimmed">
              {d.format('ddd D')}
            </Text>

            {dayTrades.map((trade) => (
              <Link
                key={trade.id}
                to={`/journal/${trade.id}`}
                className={`${classes.agendaEvent} ${eventClass(trade.performance_r)}`}
              >
                {`${dayjs(trade.trade_date).format('HH:mm')} ${assetName(trade.asset_id)}: ${formatR(trade.performance_r)}`}
              </Link>
            ))}

            {weeklySum !== undefined && (
              <div className={`${classes.agendaReview} ${reviewClass(weeklySum)}`}>
                {weeklyReviewLabel}: {formatR(weeklySum)}
              </div>
            )}

            {isLastTradingDay && monthSum !== null && (
              <div className={`${classes.agendaReview} ${reviewClass(monthSum)}`}>
                {monthlyReviewLabel}: {formatR(monthSum)}
              </div>
            )}
          </div>
        )
      })}
    </Stack>
  )
}
