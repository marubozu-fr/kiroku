# Issue #72 — Dashboard page (mockup)

Static HTML/CSS mockups for the **Dashboard** page: a header with an `R / %`
display-mode toggle and a `YTD / 1Y / 5Y / ALL` period selector, a row of 5 KPI
cards, a charts card with two tabs (Month by Month bar chart + Equity Curve area
chart), and a Recent Activity table of the last 10 trades. No React, no build.
Structure mirrors Mantine + Recharts 1:1 so the `frontend-dev` agent can
translate directly. Colors/spacing come from `kiroku-mockup.css` CSS variables
that mirror Mantine's dark theme — in the real app these are Mantine tokens
(`var(--mantine-color-*)`), never hardcoded.

Reference: `docs/DESIGN_SYSTEM.md`. Base tokens/components copied verbatim from
`docs/mockups/issue-65/kiroku-mockup.css` (this folder is self-contained — no
cross-folder imports); dashboard-specific styles added below the
`ISSUE #72 ADDITIONS` banner in the CSS.

## Files

| File | Purpose |
|------|---------|
| `dashboard.html` | Desktop (≥1200px) — POPULATED with realistic trading data |
| `dashboard-empty.html` | Desktop — EMPTY state (no trades): welcome + feature preview + CTA |
| `dashboard-mobile.html` | Mobile (≤768px) — populated, wrapped in a ~390px phone frame to show the stacked layout |
| `kiroku-mockup.css` | Shared theme tokens + base components (from issue-65) + dashboard styles |

Open the HTML files directly in a browser. Resize `dashboard.html` below ~768px
(Mantine `sm`) to see the KPI cards collapse to 2 columns and the header toggles
go full-width; `dashboard-mobile.html` is pre-framed to phone width.

---

## Component mapping (UI element → Mantine component)

### Layout & header
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| App shell / navbar | `AppShell` + `AppShell.Navbar` | Canonical — "Dashboard" link active |
| Page header row | `Group justify="space-between"` + `Title order={2}` | Title left, controls right |
| Display mode toggle | `SegmentedControl` | `data={['R','%']}`, default `R`; switches every value between `_r` and `_pct` fields |
| Period selector | `SegmentedControl` | `data={['YTD','1Y','5Y','ALL']}`, default `YTD`; refilters stats / monthly / equity |

### KPI cards
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| KPI container | `SimpleGrid cols={{ base: 2, sm: 5 }}` | 5-up desktop, 2 cols mobile (Best/Worst spans full width) |
| KPI card | `Card shadow="sm" radius="md" padding="md"` | label `Text fz="sm" c="dimmed"`, value `Text fz="xl" fw={700} ff="monospace"` |
| Total Trades | `Text ff="monospace"` | **count, not money** → never green/red (bright default) |
| Win Rate | `Text ff="monospace"` | green if ≥50%, red if <50% (63.83% → green) |
| Avg R | shared `<RValue>` | `+X.XXR` / `+X.XX%`, semantic green/red/dimmed |
| Profit Factor | `Text ff="monospace"` | green ≥1.5, dimmed 1.0–1.5, red <1.0 (2.14 → green) |
| Best / Worst | two `<RValue>` in one card | best green, worst red, `/` separator dimmed |

### Charts
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Charts container | `Card` + `Tabs` | `Tabs.List` with two `Tabs.Tab`; "Month by Month" default |
| Month by Month | Recharts `BarChart` + `Bar` | green `<Cell>` for positive months, red for negative, zero baseline, Y-axis in R; mockup uses a hand-authored CSS bar chart (`.barchart`) |
| Equity Curve | Recharts `AreaChart` + `Area` | cumulative line, filled area, green above 0 / red below; mockup uses inline `<svg>` (`.equity-preview`) |
| Chart values | driven by `R / %` toggle | `value_r`/`value_pct` (bars), `cumulative_r`/`cumulative_pct` (equity) |

### Recent Activity
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Activity table | `Table striped highlightOnHover` `fz="sm"` | dense; last 10 trades, most recent first |
| Table header | `Table.Th` → `Text size="xs" c="dimmed" tt="uppercase"` | Asset / Direction / Date / P&L (R) |
| Row | `Table.Tr` clickable → `/trades/:id` | cursor pointer (base table behaviour) |
| Direction badge | `Badge color="teal"` (Long) / `"grape"` (Short) | non-semantic hues |
| P&L (R) | shared `<RValue>` | monospace, right-aligned, signed, semantic green/red/dimmed |
| Footer link | `Anchor` / `Button variant="light"` | "View all trades →" → Journal page |

### Empty state
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Empty container | `Card` → centered `Stack align="center"` | shown when there are no trades |
| Icon | `ThemeIcon` / dashboard icon | |
| Message | `Text fw={600}` + `Text c="dimmed"` | "Welcome to your dashboard" + guidance |
| Feature preview | `SimpleGrid cols={3}` of `Paper withBorder` | Key statistics / Performance charts / Recent activity |
| CTA | `Button variant="filled"` | "Add my first trade" → trade form |
| Header toggles | `SegmentedControl disabled` | inert/dimmed — no data to switch |

### Financial numbers
All counts/percentages/R values use monospace. The shared `<RValue>` helper
renders P&L/R as `ff="monospace"`, right-aligned in tables, **signed + semantic
color** (green profit / red loss / dimmed breakeven). Total Trades, Win Rate and
Profit Factor are monospace but follow their own thresholds — they are not raw
P&L, so they are NOT colored by sign.

---

## Color usage (per DESIGN_SYSTEM.md)

| Use | Token | Where |
|-----|-------|-------|
| Profit / positive R | `green.6` | Avg R `+0.82R`, positive monthly bars, equity area/line, winning rows, Best `+6.00R`, Win Rate ≥50%, Profit Factor ≥1.5 |
| Loss / negative R | `red.6` | negative monthly bars, losing rows, Worst `-2.30R`; (Win Rate <50% / PF <1.0 would use red) |
| Neutral / breakeven / no data | `dimmed` | `0.00R` breakeven row, KPI sub-labels, axis/grid labels, Profit Factor 1.0–1.5 |
| Brand / primary | `blue.6` | active nav, active tab underline, CTA button, focus ring |
| Long direction | `teal` | direction badge |
| Short direction | `grape` | direction badge |

Green/red are reserved for P&L/R and the win-rate / profit-factor thresholds
only. **Total Trades** (a count) and the **YTD/period labels** are not money, so
they are never colored green/red. Direction badges use teal/grape so they never
collide with profit/loss. Chart axis lines use `--border`, axis labels use
`--dimmed`.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS emulates Mantine
responsive props at `max-width: 768px`.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger drawer (`AppShell` collapsed) |
| Header right cluster | inline (toggles side by side) | wraps full-width below the title |
| KPI cards | `cols={5}` (5-up row) | `cols={2}`; Best/Worst card spans full width |
| Charts card | tabs side by side, charts full card width | same; charts keep min-height, value labels dropped to reduce clutter |
| Bar chart | 12 columns with `+X.X` value labels | 12 columns, single-letter month axis, no per-bar labels |
| Equity curve | full inline SVG | full-width SVG (axis text trimmed) |
| Recent Activity table | full table | horizontally scrollable (`Table.ScrollContainer`) |

### Responsive decision

The 5 KPI cards are the densest element. On phones, five equal columns would be
~70px each — too narrow for monospace values like `63.83%` or `+6.00R`. We
therefore drop to **2 columns** and let the **Best / Worst** card (which holds
two values) **span the full width** so all numbers stay readable. The charts
stay full-width and keep their 300px / 220px heights so they still "breathe" per
the design system. The Recent Activity table becomes horizontally scrollable
rather than reflowing into cards, preserving the tabular density traders expect.

### Empty-state decision

The empty dashboard keeps the page title and shows both toggles as **inert
(disabled + dimmed)** rather than hiding them. This keeps the page recognisable
as the Dashboard and signals that controls exist, while making clear there is
nothing to switch yet. The body is a single centered `.empty-state` card with a
3-item feature preview (Key statistics / Performance charts / Recent activity)
and a primary CTA to the trade form.

### Chart-tabs decision (static file)

A real `Tabs` only renders one panel at a time. In a static mockup that would
hide half the design, so `dashboard.html` shows **Tab 1 (Month by Month) active**
and ALSO renders the **Equity Curve** panel immediately below it, labelled
"(tab 2 preview)", so reviewers can see both designs at once. In the app these
are two `Tabs.Panel`s and only the selected one is visible.

---

## Sample data (internally consistent)

One trader, full-year 2026 sample. The KPI cards, the monthly bars and the
Recent Activity rows all reconcile:

### KPI cards
| Card | Value | Rule applied |
|------|-------|--------------|
| Total Trades | `47` | count — not colored |
| Win Rate | `63.83%` | 30 W / 47 → ≥50% → green |
| Avg R | `+0.82R` | total ÷ trades → positive → green |
| Profit Factor | `2.14` | ≥1.5 → green |
| Best / Worst | `+6.00R / -2.30R` | best green, worst red |

`total_r = +38.50R` (Avg R 0.82 × 47 ≈ 38.5). Both extremes appear in the Recent
Activity table (US100 `+6.00R`, AUD/USD `-2.30R`).

### Monthly bars (`value_r`) and equity (`cumulative_r`)
| Month | Month R | Cumulative R |
|-------|---------|--------------|
| Jan | +4.20 | +4.20 |
| Feb | −1.80 | +2.40 |
| Mar | +6.50 | +8.90 |
| Apr | +2.10 | +11.00 |
| May | −3.40 | +7.60 |
| Jun | +7.00 | +14.60 |
| Jul | +5.40 | +20.00 |
| Aug | +3.80 | +23.80 |
| Sep | +6.20 | +30.00 |
| Oct | +4.50 | +34.50 |
| Nov | +2.20 | +36.70 |
| Dec | +1.80 | **+38.50** |

The 12 monthly bars sum to **+38.50R**, matching `total_r` and the final equity
point. Feb and May are the two red (losing) months; every cumulative value stays
positive, so the equity area sits entirely above the zero baseline (all green).

### Recent Activity (last 10 trades, most recent first)
| Asset | Direction | Date | P&L (R) |
|-------|-----------|------|---------|
| EUR/USD | Long | 2026-06-09 | +5.00R |
| GBP/USD | Short | 2026-06-08 | +1.30R |
| US100 | Long | 2026-06-05 | +6.00R |
| AUD/USD | Long | 2026-06-04 | −2.30R |
| SPX | Long | 2026-06-03 | +3.00R |
| GBP/JPY | Short | 2026-06-02 | −1.00R |
| GOLD | Long | 2026-05-29 | 0.00R |
| EUR/USD | Short | 2026-05-28 | −2.00R |
| US30 | Long | 2026-05-27 | +2.20R |
| USD/JPY | Short | 2026-05-26 | +1.80R |

Recent Activity is independent of the period selector (always the last 10
trades). The bars/equity/stats refilter on YTD/1Y/5Y/ALL.

---

## Backend mapping (`GET /api/dashboard`)

Returns `{ stats, monthly, equity, recent_trades }`:

| Response field | Used by | Notes |
|----------------|---------|-------|
| `stats.total_trades` | Total Trades KPI | count |
| `stats.win_rate` | Win Rate KPI | threshold 50% |
| `stats.avg_r` / `stats.total_pct` proxy | Avg R KPI | toggles with `R / %` |
| `stats.profit_factor` | Profit Factor KPI | thresholds 1.0 / 1.5 |
| `stats.best_r` / `stats.worst_r` | Best / Worst KPI | |
| `stats.total_r` / `stats.total_pct` | reconciliation / equity end | |
| `monthly[].value_r` / `value_pct` | Month by Month bars | `R / %` toggle picks the field |
| `monthly[].month_label` | bar X-axis | |
| `equity[].cumulative_r` / `cumulative_pct` | Equity Curve | `R / %` toggle picks the field |
| `recent_trades[]` | Recent Activity table | `asset_name`, `direction`, `trade_date`, `performance_r`/`performance_pct` |

The `R / %` toggle switches every value between the `_r` and `_pct` fields. The
`YTD / 1Y / 5Y / ALL` period selector refilters `stats`, `monthly` and `equity`
(`recent_trades` is independent of period).

---

## Acceptance-criteria & deliverables checklist

### Issue requirements
- [x] **Header controls** — `Title` left; `R / %` toggle (R default) + `YTD/1Y/5Y/ALL` selector (YTD default) right.
- [x] **5 KPI cards, single row** — Total Trades, Win Rate, Avg R, Profit Factor, Best/Worst via `SimpleGrid cols={{ base: 2, sm: 5 }}`.
- [x] **KPI color rules** — Total Trades not colored; Win Rate ≥50% green; Avg R semantic; Profit Factor ≥1.5 green; Best green / Worst red.
- [x] **Charts as tabs** — `Tabs`: "Month by Month" (active) + "Equity Curve".
- [x] **Month by Month** — CSS bar chart, green/red bars, zero baseline, month X-axis, Y-axis in R, min-height 300px.
- [x] **Equity Curve** — inline-SVG area/line, cumulative, filled area, green above 0; previewed in the static file.
- [x] **Recharts note** — `.note` mapping charts to Recharts `BarChart` / `AreaChart`.
- [x] **Recent Activity** — dense `Table fz="sm"` of last 10 trades; Asset / Direction badge / Date / P&L (R); clickable rows; "View all trades →" footer link.
- [x] **Empty state** — `.empty-state` card: icon, "Welcome to your dashboard", description, 3-item feature preview, "Add my first trade" CTA.
- [x] **Responsive** — KPI 5 → 2 cols (Best/Worst full width); charts full-width; table scrollable; navbar → hamburger.

### Design-system compliance
- [x] Mantine dark theme tokens; semantic green=profit / red=loss / dimmed=neutral.
- [x] Green/red used ONLY for P&L/R and win-rate / profit-factor thresholds (not for counts or period labels).
- [x] Monospace for all financial numbers; right-aligned + signed in the table.
- [x] Direction badges teal/grape (non-semantic).
- [x] Charts ≥300px (bars) and breathe; axis/grid use `--border` / `--dimmed`.
- [x] Empty state per "States" guidance (not a blank screen).
- [x] No inline styles for theme values — everything in `kiroku-mockup.css`; only proportional bar heights use a `style` attribute (data-driven geometry); 2-space indentation.

### Deliverables
- [x] Desktop populated — `dashboard.html`.
- [x] Desktop empty — `dashboard-empty.html`.
- [x] Mobile populated — `dashboard-mobile.html`.
- [x] Self-contained stylesheet (issue-65 base + ISSUE #72 ADDITIONS) — `kiroku-mockup.css`.
- [x] Component mapping + color usage + responsive notes + sample data + checklist — this README.
