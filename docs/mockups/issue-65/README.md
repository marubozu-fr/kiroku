# Issue #65 — Journal calendar page with year statistics (mockup)

Static HTML/CSS mockups for the redesigned **Journal** page: a year selector,
4 statistics cards, a Calendar/List view toggle, and a monthly trading-day
calendar with trade events plus weekly/monthly performance reviews. No React,
no build. Structure mirrors Mantine components 1:1 so the `frontend-dev` agent
can translate directly. Colors/spacing come from `kiroku-mockup.css` CSS
variables that mirror Mantine's dark theme — in the real app these are Mantine
tokens (`var(--mantine-color-*)`), never hardcoded.

Reference: `docs/DESIGN_SYSTEM.md`. Base tokens/components copied from
`docs/mockups/issue-49/kiroku-mockup.css` (this folder is self-contained — no
cross-folder imports); calendar-specific styles added below the
`ISSUE #65 ADDITIONS` banner in the CSS.

## Files

| File | Purpose |
|------|---------|
| `journal-calendar.html` | Calendar view (DEFAULT) — June 2026 grid, populated with sample trades + weekly/monthly reviews |
| `journal-list.html` | List view — same header/cards/toggle (List active) over the existing trades table |
| `journal-empty.html` | Empty state — year 2023 selected, no trades, helpful CTA |
| `kiroku-mockup.css` | Shared theme tokens + base components + calendar styles |

Open the HTML files directly in a browser. Resize below ~768px (Mantine `sm`)
to see the calendar switch to the vertical agenda layout and the stat cards
collapse to 2×2.

---

## Component mapping (UI element → Mantine component)

### Layout & header
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| App shell / navbar | `AppShell` + `AppShell.Navbar` | Canonical — "Journal" link active |
| Page header row | `Group justify="space-between"` + `Title order={2}` | Title left, controls right |
| Year selector | `Select` | Data = years that have trades (`2026 / 2025 / 2024`); defaults to current year (2026); `allowDeselect={false}` |
| New Trade | `Button variant="filled"` `leftSection={<IconPlus/>}` | App convention; navigates to trade create |

### Statistics
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Stat cards container | `SimpleGrid cols={{ base: 2, sm: 4 }}` | 4-up desktop, 2×2 mobile |
| Stat card | `Card padding="md" radius="md"` | label `Text size="sm" c="dimmed"`, value `Text size="xl" fw={700} ff="monospace"` |
| Total Trades / Win Rate values | `Text ff="monospace"` | counts/percentage — **not** P&L, so **not** green/red |
| Total P&L / Avg. P&L values | shared `<RValue>` | signed `+X.XXR`, **semantic** green/red/dimmed |

### View toggle
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Calendar / List toggle | `SegmentedControl` | `data={['Calendar','List']}`, default `Calendar`; controls which view renders |

### Calendar view
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Calendar container | `Card padding="md" radius="md"` | wraps nav + grid |
| Month nav (prev/next) | `ActionIcon variant="default"` (`IconChevronLeft/Right`) | + centered `Text fw={700}` month label |
| Weekday header (MON..FRI) | `SimpleGrid cols={5}` of `Text size="xs" c="dimmed"` | trading days only — no Sat/Sun |
| Calendar grid | `SimpleGrid cols={5}` (one cell per trading day) | weeks flow row by row; `min-height` per cell for density |
| Day cell | `Paper withBorder p="xs"` | day number `Text size="xs" c="dimmed"`; outside-month cells dimmed; today gets accent border |
| Trade event | `UnstyledButton` / `Anchor component={Link} to={`/trades/${id}`}` | monospace pill, left color accent, `IconX`-style truncation via `text-overflow: ellipsis` |
| Overflow indicator | `Text size="xs" c="dimmed"` ("+N more") → `Popover`/`HoverCard` or expand | shown when a day has >2 events |
| Weekly review | styled `Box` in the Friday cell | dashed border band; `WEEKLY REVIEW: +X.XXR`, colored by week sum |
| Monthly review | styled `Box` on last trading day | solid `currentColor` border (most prominent); `MONTHLY REVIEW: +X.XXR`, colored by month sum |

### List view
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Trades table | `Table striped highlightOnHover` `fz="sm"` | **existing table, unchanged per issue** — shown for completeness |
| Table header | `Table.Th` → `Text size="xs" c="dimmed" tt="uppercase"` | |
| Direction badge | `Badge color="teal"` (Long) / `"grape"` (Short) | non-semantic hues |
| Status badge | `Badge` blue/gray/yellow/gray | Open / Closed / Partial / Breakeven |
| Price columns | `Text ff="monospace"` right-aligned | raw prices — **not** semantically colored |
| P&L (R) column | shared `<RValue>` | monospace, right-aligned, signed, semantic green/red/dimmed |

### Empty state
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Empty container | `Card` → centered `Stack align="center"` | shown when selected year has no trades |
| Icon | `ThemeIcon` / `IconCalendarOff` size large | |
| Message + suggestion | `Text fw={600}` + `Text c="dimmed"` | "No trades for 2023" + guidance |
| CTA | `Button variant="filled"` | "Log your first trade" |

### Financial numbers
All counts/prices/percentages/R values use monospace. The shared `<RValue>`
helper renders P&L/R as `ff="monospace"`, right-aligned in tables,
**signed + semantic color** (green profit / red loss / dimmed breakeven). Raw
entry/exit prices are monospace but **not** semantically colored.

---

## Color usage (per DESIGN_SYSTEM.md)

| Use | Token | Where |
|-----|-------|-------|
| Profit / positive R | `green.6` | `+38.50R` total, `+0.82R` avg, winning trade events, positive weekly/monthly reviews |
| Loss / negative R | `red.6` | losing trade events, negative weekly review (`-2.80R`) |
| Neutral / breakeven / no data | `dimmed` | `0.00R` breakeven event, open-trade `—` exit |
| Brand / primary | `blue.6` | New Trade button, active nav, today's cell accent border, focus ring |
| Long direction | `teal` | direction badge (list) |
| Short direction | `grape` | direction badge (list) |
| Status | blue/gray/yellow | Open / Closed+Breakeven / Partial badges |

Green/red are reserved for P&L/R only. Counts (Total Trades) and Win Rate use
the default bright text — they are not money, so they are never colored
green/red. Direction badges use teal/grape so they never collide with profit/loss.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS emulates Mantine
responsive props at `max-width: 768px`.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger drawer (`AppShell` collapsed) |
| Stat cards | `cols={4}` (4-up row) | `cols={2}` (**2×2 grid**) |
| View toggle | inline, capped width (~280px) | full-width segmented |
| Page header right cluster | inline | wraps below title (`Group` wraps) |
| **Calendar** | Mon–Fri `SimpleGrid cols={5}` grid | **vertical agenda list**: events grouped by day (date heading + that day's events/reviews) |
| Trade event text | single-line, truncated with ellipsis | wraps to multiple lines (full text) |
| List table | full table | horizontally scrollable (`Table.ScrollContainer`) |

### Responsive calendar decision

On phones a 5-column grid leaves each trading-day cell ~60px wide — far too
narrow for `HH:MM ASSET: +X.XXR` events. We therefore **switch to a vertical
agenda layout** below `sm` rather than horizontal scrolling: each day with
activity becomes a dated section listing its trade events and any weekly/monthly
review, in chronological order. This keeps every event fully readable (text can
wrap), preserves the green/red semantics and the review styling, and matches the
issue's "switches to a list layout on small screens." Empty days are omitted in
the agenda to reduce scrolling. Implementation: render the grid inside a
`Box visibleFrom="sm"` and the agenda inside a `Box hiddenFrom="sm"` (the mockup
toggles `.cal-grid` / `.cal-agenda` via the media query).

---

## Sample data (June 2026 — internally consistent)

June 1, 2026 is a Monday, so the grid starts clean. Today is **June 10**
(highlighted). Weekly reviews sit in each Friday cell; the monthly review sits on
the last trading day (Tue **June 30**). Weekly sums aggregate that week's trades:

| Week | Trades (sum) | Weekly review |
|------|--------------|---------------|
| Jun 1–5 | +5.00, −1.00, +2.50, +1.50, −1.00, 0.00 (1 breakeven hidden behind "+1 more") | **+7.00R** (green) |
| Jun 8–12 | +3.00, −2.00, +4.20, 0.00, +1.30 | **+6.50R** (green) |
| Jun 15–19 | −1.50, +2.00, −1.00, −2.30 | **−2.80R** (red) |
| Jun 22–26 | +6.00, +1.50, +2.00, −1.00, +3.00 | **+11.50R** (green) |
| Jun 29–30 | +5.00, +1.30 | **Monthly Review +28.50R** (green, last trading day) |

The June grid demonstrates all three event states (win/loss/breakeven), a
multi-trade day with a **"+1 more"** overflow indicator (Jun 5), both review
types, and a losing week. The 4 year stat cards (47 trades, +38.50R, 63%,
+0.82R) reflect the full year 2026, of which June is one slice — so the monthly
review total intentionally differs from the year total.

---

## Acceptance-criteria & deliverables checklist

### Issue requirements
- [x] **Year selector** — `Select` listing years with trades, defaults to current year (2026).
- [x] **4 stat cards** — Total Trades, Total P&L (semantic), Win Rate, Avg. P&L (semantic); `SimpleGrid cols={{ base: 2, sm: 4 }}`; all values monospace.
- [x] **Calendar/List toggle** — `SegmentedControl`, Calendar default; own row between cards and content.
- [x] **Calendar view** — Mon–Fri grid only, prev/next month nav + centered "June 2026", day numbers, muted out-of-month cells, today highlighted.
- [x] **Trade events** — `HH:MM ASSET: +X.XXR`, green/red/gray semantics, clickable to `/trades/:id`, multi-trade stacking + "+1 more" overflow.
- [x] **Weekly review** — Friday cell, `WEEKLY REVIEW: +X.XXR`, colored by week sum, visually distinct (dashed band).
- [x] **Monthly review** — last trading day (Jun 30), `MONTHLY REVIEW: +X.XXR`, colored by month sum, most prominent style.
- [x] **List view** — header + cards + toggle (List active) over the existing trades table (unchanged).
- [x] **Empty state** — year with no trades (2023): icon + message + CTA (not blank).
- [x] **Responsive** — cards 2×2; calendar → vertical agenda; navbar → hamburger.

### Design-system compliance
- [x] Mantine dark theme tokens; semantic green=profit / red=loss / dimmed=neutral.
- [x] Green/red used ONLY for P&L/R (not for counts or win rate).
- [x] Monospace for all financial numbers; right-aligned + signed in the table.
- [x] Direction badges teal/grape (non-semantic).
- [x] Empty state per "States" guidance.
- [x] No inline styles — everything in `kiroku-mockup.css` (CSS Modules discipline); 2-space indentation.

### Deliverables
- [x] Calendar view (populated) — `journal-calendar.html`.
- [x] List view — `journal-list.html`.
- [x] Empty state — `journal-empty.html`.
- [x] Shared self-contained stylesheet — `kiroku-mockup.css`.
- [x] Component mapping + color usage + responsive notes + checklist — this README.
