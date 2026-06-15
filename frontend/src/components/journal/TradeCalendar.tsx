import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  HoverCard,
  Paper,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react'
import dayjs, { type Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import type { AccountType, TradeSummary } from '@/types/trade'
import type { NewsEvent, NewsImpact } from '@/types/news'
import { newsApi } from '@/services/news'
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
  /** Account types whose trades are rendered in the grid/agenda. */
  selectedAccountTypes: Set<AccountType>
}

const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

/** Returns the CSS class for a review band based on the signed value. */
function reviewClass(value: number): string {
  if (value > 0) return classes.reviewProfit ?? ''
  if (value < 0) return classes.reviewLoss ?? ''
  return classes.reviewNeutral ?? ''
}

/** Returns the CSS class for a trade event based on performance_r. */
function eventClass(performanceR: number | null): string {
  if (performanceR === null || performanceR === 0) return classes.eventNeutral ?? ''
  return performanceR > 0 ? (classes.eventProfit ?? '') : (classes.eventLoss ?? '')
}

/**
 * Returns the extra CSS classes for a non-live (demo/test) trade event. Live
 * trades get nothing — they keep the unchanged green/red treatment.
 */
function accountClass(accountType: AccountType): string {
  if (accountType === 'demo') return `${classes.nonlive} ${classes.demo}`
  if (accountType === 'test') return `${classes.nonlive} ${classes.test}`
  return ''
}

/* ── News impact helpers ─────────────────────────────────────────────────── */

const IMPACT_RANK: Record<NewsImpact, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NONE: 0,
}

/** Returns the impact level with the highest rank among the provided events. */
function highestImpact(events: NewsEvent[]): NewsImpact {
  return events.reduce<NewsImpact>(
    (best, ev) => (IMPACT_RANK[ev.impact] > IMPACT_RANK[best] ? ev.impact : best),
    'NONE',
  )
}

/** Returns the CSS class for a news element based on its impact level. */
function newsImpactClass(impact: NewsImpact): string {
  if (impact === 'HIGH') return classes.newsEventHigh ?? ''
  if (impact === 'MEDIUM') return classes.newsEventMedium ?? ''
  return classes.newsEventLow ?? ''
}

/** Inline account badge ("Demo"/"Test") shown on non-live events; null for live. */
function AccountBadge({ accountType }: { accountType: AccountType }) {
  const { t } = useTranslation()
  if (accountType === 'live') return null
  return <span className={classes.acctBadge}>{t(`journal.account_type.${accountType}`)}</span>
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
      className={`${classes.event} ${eventClass(trade.performance_r)} ${accountClass(trade.account_type)} ${extraClass ?? ''}`}
      title={label}
    >
      <AccountBadge accountType={trade.account_type} />
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

/* ── News sub-components ─────────────────────────────────────────────────── */

interface NewsEventPillProps {
  event: NewsEvent
  /** When true (mobile agenda) the currency code is prepended to the title. */
  withCurrency?: boolean
}

/**
 * A single news event pill. Non-clickable, styled by impact.
 * Used for single-event days on the desktop grid, and for every news event
 * in the mobile agenda.
 */
function NewsEventPill({ event, withCurrency }: NewsEventPillProps) {
  const time = dayjs(event.date).format('HH:mm')
  const title = withCurrency ? `${event.currency} · ${event.title}` : event.title
  const impact = event.impact === 'NONE' ? 'LOW' : event.impact
  const nativeTitle = `${time} ${event.title} (${event.currency}, ${impact})`

  const pillClass = [
    classes.newsEvent,
    newsImpactClass(event.impact),
    withCurrency ? classes.agendaNewsEvent : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Box className={pillClass} title={nativeTitle}>
      <span className={classes.newsIcon}>
        <IconCalendarEvent size={12} />
      </span>
      <span className={classes.newsTime}>{time}</span>
      <span className={classes.newsTitle}>{title}</span>
    </Box>
  )
}

interface NewsIndicatorProps {
  events: NewsEvent[]
}

/**
 * A compact indicator badge shown when 2+ news events exist on a day.
 * Opens a HoverCard listing events grouped by currency.
 */
function NewsIndicator({ events }: NewsIndicatorProps) {
  const { t } = useTranslation()
  const count = events.length
  const topImpact = highestImpact(events)

  // Build currency groups: iterate events sorted by time, group by currency,
  // preserve first-seen order.
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date))
  const currencyOrder: string[] = []
  const currencyGroups: Record<string, NewsEvent[]> = {}
  for (const ev of sortedEvents) {
    if (!(ev.currency in currencyGroups)) {
      currencyOrder.push(ev.currency)
      currencyGroups[ev.currency] = []
    }
    const group = currencyGroups[ev.currency]
    if (group != null) group.push(ev)
  }

  const indicatorClass = [
    classes.newsIndicator,
    newsImpactClass(topImpact),
  ].join(' ')

  return (
    <HoverCard
      position="bottom-start"
      withinPortal
      shadow="md"
      openDelay={150}
      closeDelay={100}
    >
      <HoverCard.Target>
        <Box
          className={indicatorClass}
          tabIndex={0}
          role="button"
          aria-label={t('journal.calendar.news.events_count', { count })}
        >
          <IconCalendarEvent size={13} />
          <span>{count}</span>
        </Box>
      </HoverCard.Target>

      <HoverCard.Dropdown className={classes.newsHoverCard}>
        {currencyOrder.map((currency) => {
          const groupEvents = currencyGroups[currency]
          if (groupEvents == null) return null
          return (
            <div key={currency}>
              <div className={classes.newsCurrencyGroup}>
                <span>{currency}</span>
                <span className={classes.currencyCount}>({groupEvents.length})</span>
              </div>
              {groupEvents.map((ev) => {
                const dotClass = [
                  classes.impactDot,
                  ev.impact === 'HIGH'
                    ? classes.impactDotHigh
                    : ev.impact === 'MEDIUM'
                      ? classes.impactDotMedium
                      : classes.impactDotLow,
                ].join(' ')
                return (
                  <div key={ev.id} className={classes.newsRow}>
                    <span className={classes.newsRowTime}>
                      {dayjs(ev.date).format('HH:mm')}
                    </span>
                    <span className={classes.newsRowTitle}>{ev.title}</span>
                    <Box className={dotClass} />
                  </div>
                )
              })}
            </div>
          )
        })}
      </HoverCard.Dropdown>
    </HoverCard>
  )
}

/**
 * Custom trading calendar — Mon–Fri grid with trade events, weekly and
 * monthly review bands.
 *
 * No external calendar library is used. The grid is CSS `grid-template-columns:
 * repeat(5, 1fr)`.
 */
export function TradeCalendar({
  trades,
  assetName,
  selectedYear,
  selectedAccountTypes,
}: TradeCalendarProps) {
  const { t } = useTranslation()

  // `live` trades drive the stats/reviews and the default month — those always
  // stay live-only regardless of which account types are toggled on.
  const liveTrades = useMemo(
    () => trades.filter((trade) => trade.account_type === 'live'),
    [trades],
  )

  // Trades actually rendered in the grid/agenda — live plus any opted-in
  // demo/test types. Styling marks the non-live ones as "doesn't count".
  const visibleTrades = useMemo(
    () => trades.filter((trade) => selectedAccountTypes.has(trade.account_type)),
    [trades, selectedAccountTypes],
  )

  const [displayMonth, setDisplayMonth] = useState<Dayjs>(() =>
    defaultDisplayMonth(liveTrades, selectedYear),
  )

  // ── News state: keyed by 'YYYY-MM', populated lazily per-month ──────────
  const [newsByMonth, setNewsByMonth] = useState<Record<string, NewsEvent[]>>({})

  useEffect(() => {
    const monthKey = displayMonth.format('YYYY-MM')
    if (newsByMonth[monthKey] !== undefined) return

    const controller = new AbortController()
    const { signal } = controller

    const start = displayMonth.startOf('month').format('YYYY-MM-DD')
    const end = displayMonth.endOf('month').format('YYYY-MM-DD')

    async function fetchNews() {
      try {
        let status
        try {
          status = await newsApi.status(signal)
        } catch (err) {
          if ((err as { name?: string }).name === 'AbortError') return
          // Status fetch failed — proceed to list without syncing.
          status = { is_stale: false, last_sync: null }
        }

        if (status.is_stale) {
          try {
            await newsApi.sync()
          } catch {
            // Sync failure is non-critical — continue to list.
          }
        }

        const events = await newsApi.list(start, end, signal)
        setNewsByMonth((prev) => ({ ...prev, [monthKey]: events }))
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        // News is non-critical — log and leave the month empty.
        console.error('[TradeCalendar] Failed to load news for', monthKey, err)
        setNewsByMonth((prev) => ({ ...prev, [monthKey]: [] }))
      }
    }

    void fetchNews()

    return () => {
      controller.abort()
    }
    // Only re-run when the month changes; newsByMonth cache is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMonth])

  // Group news by LOCAL date, sorted by time ascending.
  const newsByDate = useMemo<Record<string, NewsEvent[]>>(() => {
    const newsForMonth = newsByMonth[displayMonth.format('YYYY-MM')] ?? []
    const map: Record<string, NewsEvent[]> = {}
    for (const ev of newsForMonth) {
      const dateStr = dayjs(ev.date).format('YYYY-MM-DD')
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr]?.push(ev)
    }
    // Sort each day's events by date string (ISO, so lexicographic = chronological).
    for (const dateStr of Object.keys(map)) {
      map[dateStr]?.sort((a, b) => a.date.localeCompare(b.date))
    }
    return map
  }, [newsByMonth, displayMonth])

  const currentYear = dayjs().year()
  const currentMonth = dayjs().startOf('month')

  const prevDisabled = displayMonth.month() === 0
  const nextDisabled =
    displayMonth.month() === 11 ||
    (selectedYear === currentYear && displayMonth.isSame(currentMonth, 'month'))

  const showToday =
    selectedYear === currentYear && !displayMonth.isSame(currentMonth, 'month')

  const cells = useMemo(() => buildCalendarCells(displayMonth), [displayMonth])
  const byDate = useMemo(() => groupByDate(visibleTrades), [visibleTrades])
  const weeklySums = useMemo(() => weeklyReviewSums(liveTrades), [liveTrades])
  const monthSum = useMemo(
    () => monthlyReviewSum(liveTrades, displayMonth),
    [liveTrades, displayMonth],
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
            const dayNews = newsByDate[dateStr] ?? []
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
                newsEvents={dayNews}
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
          trades={visibleTrades}
          byDate={byDate}
          newsByDate={newsByDate}
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
  newsEvents: NewsEvent[]
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
  newsEvents,
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

      {/* News events rendered ABOVE trades */}
      {newsEvents.length === 1 && newsEvents[0] != null && (
        <NewsEventPill event={newsEvents[0]} />
      )}
      {newsEvents.length >= 2 && (
        <NewsIndicator events={newsEvents} />
      )}

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
  newsByDate: Record<string, NewsEvent[]>
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
  newsByDate,
  displayMonth,
  weeklySums,
  monthSum,
  lastTradingDay,
  assetName,
  weeklyReviewLabel,
  monthlyReviewLabel,
}: AgendaViewProps) {
  // Collect all active dates (have trades, news, or a review) within the displayed month.
  const activeDates = useMemo(() => {
    const dateSet = new Set<string>()
    for (const dateStr of Object.keys(byDate)) {
      const d = dayjs(dateStr)
      if (d.year() === displayMonth.year() && d.month() === displayMonth.month()) {
        dateSet.add(dateStr)
      }
    }
    // Also include days that have only news events within the displayed month.
    for (const dateStr of Object.keys(newsByDate)) {
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
  }, [byDate, newsByDate, displayMonth, weeklySums, lastTradingDay])

  if (activeDates.length === 0) {
    return null
  }

  return (
    <Stack gap="sm">
      {activeDates.map((dateStr) => {
        const d = dayjs(dateStr)
        const dayTrades = byDate[dateStr] ?? []
        const dayNews = newsByDate[dateStr] ?? []
        const isFriday = d.day() === 5
        const weeklySum = isFriday ? weeklySums[dateStr] : undefined
        const isLastTradingDay = dateStr === lastTradingDay

        return (
          <div key={dateStr} className={classes.agendaDay}>
            <Text size="sm" fw={600} c="dimmed">
              {d.format('ddd D')}
            </Text>

            {/* News events rendered BEFORE trades in the agenda (inline, no HoverCard) */}
            {dayNews.map((ev) => (
              <NewsEventPill key={ev.id} event={ev} withCurrency />
            ))}

            {dayTrades.map((trade) => (
              <Link
                key={trade.id}
                to={`/journal/${trade.id}`}
                className={`${classes.agendaEvent} ${eventClass(trade.performance_r)} ${accountClass(trade.account_type)}`}
              >
                <AccountBadge accountType={trade.account_type} />
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
