# Issue #83 — Analytics page (mockup)

Static HTML/CSS mockups for the **Analytics** page — the most data-dense page in
Kiroku. Top to bottom: page header, a collapsible **Filter panel**, a prominent
**4-up KPI row** plus a **secondary KPI grid**, four **chart cards** (Day-Hour
heatmap, Asset breakdown, R-distribution histogram, Tag breakdown) in two rows
plus a full-width **Cumulative R curve**, and a dense **paginated trades Table**.
No React, no build. Structure mirrors Mantine + Recharts 1:1 so the
`frontend-dev` agent can translate directly. Colors/spacing come from
`kiroku-mockup.css` CSS variables that mirror Mantine's dark theme — in the real
app these are Mantine tokens (`var(--mantine-color-*)`), never hardcoded.

Reference: `docs/DESIGN_SYSTEM.md`. Base tokens/components copied verbatim from
`docs/mockups/issue-72/kiroku-mockup.css` (this folder is self-contained — no
cross-folder imports); analytics-specific styles added below the
`ISSUE #83 ADDITIONS` banner in the CSS.

Data shapes match the already-merged analytics API (issues #81/#82):
`GET /api/analytics/statistics`, `/api/analytics/breakdowns`,
`/api/analytics/trades` — see `backend/app/models/analytics.py`.

## Files

| File | Purpose |
|------|---------|
| `analytics.html` | Desktop (≥1200px) — POPULATED with realistic, internally-consistent data |
| `analytics-empty.html` | Desktop — EMPTY state (no trades match the active filters) |
| `analytics-mobile.html` | Mobile (≤768px) — populated, wrapped in a ~390px phone frame to show stacking |
| `kiroku-mockup.css` | Shared theme tokens + base components (from issue-72) + analytics styles |

Open the HTML files directly in a browser. Resize `analytics.html` below ~768px
(Mantine `sm`) to see the KPI cards collapse to 2 columns, the charts stack
vertically, the filter grid go single-column, and the heatmap/table scroll
horizontally; `analytics-mobile.html` is pre-framed to phone width.

---

## Component mapping (UI element → Mantine component)

### Layout & header
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| App shell / navbar | `AppShell` + `AppShell.Navbar` | "Analytics" link active |
| Page header | `Stack gap={2}` → `Title order={2}` + `Text c="dimmed"` | title + dimmed subtitle |

### Filter panel
| UI element | Mantine component | Data source |
|------------|-------------------|-------------|
| Panel container | `Card` + `Collapse` (toggled by header) | collapsible; open on desktop, collapsed on mobile |
| Panel header | `Group` + chevron `ActionIcon` + active-count `Badge` | "Filters · N active" |
| Filter grid | `SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}` | responsive auto-fill |
| Date range | two `DatePickerInput` (from / to) | `available_filters.date_range` (`min`/`max`) |
| Asset | `MultiSelect` | `available_filters.assets` (`{id,name,currency}`) |
| Direction | `SegmentedControl` All / Long / Short | `available_filters.directions` → `direction` param |
| Entry TF | `MultiSelect` | `available_filters.timeframes` → `entry_timeframe` |
| Tags | `MultiSelect` + `SegmentedControl` AND/OR | `available_filters.tags` → `tag_ids` + `tags_logic` |
| Emotions | `MultiSelect` | `available_filters.emotions` → `emotion_ids` |
| Account type | `SegmentedControl` All / Live / Demo / Test | `available_filters.types` → `types` param |
| Missed opportunities | `Switch` (off by default) | `include_missed` param |
| P&L range | `Select` (≥/≤) + `NumberInput` | `pnl_operator` (`gte`/`lte`) + `pnl_value` |
| Duration | `Select` (≥/≤) + `NumberInput` + `Select` (min/hours/days) | `duration_operator` + `duration_value` + `duration_unit` |
| Reset | `Button variant="subtle"` | clears all params |

Options with no matching trades render **disabled** (Mantine `disabled` item).

### KPI cards
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Main row | `SimpleGrid cols={{ base: 2, sm: 4 }}` of `Card` | prominent, `fz="xl"` values |
| Secondary row | `SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }}` of `Card` | smaller, `fz="lg"` values |
| Total Trades | `Text ff="monospace"` | **count** → never colored |
| Total P&L (R) | shared `<RValue>` | semantic green/red/dimmed |
| Win Rate | `Text ff="monospace"` | green ≥50%, red <50% (59.52% → green) |
| Profit Factor | `Text ff="monospace"` | green ≥1.5, dimmed 1.0–1.5, red <1.0 (2.36 → green) |
| Avg P&L / Avg Win / Avg Loss / Expectancy | `<RValue>` | semantic |
| Avg Duration | `Text ff="monospace"` | not money → not colored |
| Best / Worst | two `<RValue>` in one `Card` | best green, worst red, `/` separator |
| Win / Loss Streak | two counts in one `Card` | **neutral** bright-default text (`.split .streak`); counts, never P&L green/red |

### Charts (Recharts)
| UI element | Recharts | Mockup stand-in |
|------------|----------|-----------------|
| Day-Hour heatmap | custom grid (`<Cell>`/SVG `rect`) | CSS grid `.heatmap` (7×24); cell bg alpha = win-rate intensity; red tint where losing-skewed; empty = faint |
| Asset breakdown | horizontal `BarChart` | CSS `.hbars` rows: label + win%/count meta, bar scaled to max |abs| total, signed R value |
| R-distribution | `BarChart` (0.5R buckets) | CSS `.histogram`: green bars ≥0, red <0, dashed-strong zero line between `-0.5..0` and `0..0.5` |
| Tag breakdown | horizontal `BarChart` | same `.hbars` format as assets |
| Cumulative R curve | `AreaChart` + `Area` | inline `<svg>` `.rcurve`: cumulative line, green fill, **dashed** zero reference line |
| Data sources | — | `breakdowns.by_day_hour`, `by_asset`, `r_distribution`, `by_tag`, `cumulative_r` |

### Trades table
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Table | `Table striped highlightOnHover` `fz="sm"` `verticalSpacing="xs"` | dense |
| Columns | Date · Asset · Direction (icon) · Entry TF · Tags (badges) · Emotions (badges) · P&L (R) · Duration | sort by date desc default |
| Direction | `ThemeIcon`/text `↑`/`↓` | teal (Long) / grape (Short) — non-semantic |
| Tags | `Badge color="cyan"` group | non-semantic |
| Emotions | `Badge color="indigo"` group | non-semantic |
| P&L (R) | shared `<RValue>` | monospace, right-aligned, signed, semantic |
| Duration | `Text ff="monospace"` right | `duration_minutes` formatted |
| Row | `Table.Tr` clickable → `/trades/:id` | cursor pointer |
| Pagination | `Pagination` (20/page) | `pagination.{page,per_page,total,total_pages}` |

### States
| State | Treatment |
|-------|-----------|
| Loading | `Skeleton` for KPI values, chart blocks, and table rows (`.skeleton` helper provided in CSS) |
| Empty | `analytics-empty.html` — filter panel stays; KPIs/charts/table replaced by one centered `.empty-state` card + "Reset filters" CTA |
| Error | orange notification with retry (per DESIGN_SYSTEM "States") |
| Populated | `analytics.html` |

---

## Color usage (per DESIGN_SYSTEM.md)

| Use | Token | Where |
|-----|-------|-------|
| Profit / positive R | `green.6` | Total/Avg P&L, positive breakdown bars, positive histogram buckets, equity area/line, Best, Win Rate ≥50%, Profit Factor ≥1.5, winning rows |
| Loss / negative R | `red.6` | negative breakdown bars (USD/JPY, News), negative histogram buckets, Worst, Avg Loss, losing rows |
| Neutral / breakeven / no data | `dimmed` | `0.00R` row, KPI sub-labels, axis/grid labels, empty heatmap cells, Profit Factor 1.0–1.5 |
| Brand / primary | `blue.6` | active nav, filter focus ring, switch ON, active page, active-filter count badge |
| Long direction | `teal` | direction icon |
| Short direction | `grape` | direction icon |
| Tags | `cyan` | tag badges (non-financial) |
| Emotions | `indigo` | emotion badges (non-financial) |
| Heatmap intensity | `green.6` alpha ramp | single continuous scale — higher win rate = more opaque green; low win rate = faintest green (matches legend) |

Green/red are reserved for P&L/R and the win-rate / profit-factor thresholds.
**Total Trades**, **Avg Duration** and **Win/Loss streak** are not money, so they
are rendered in neutral bright-default text — never green/red. Direction/Tags/Emotions use teal/grape/cyan/indigo so
they never collide with profit/loss.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS emulates Mantine
responsive props at `max-width: 768px`.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger drawer (`AppShell` collapsed) |
| Filter panel | open, multi-column grid | **collapsed** by default; grid → 1 col when opened |
| KPI main | `cols={4}` | `cols={2}` |
| KPI secondary | auto-fit (~7-up) | `cols={2}` |
| Chart rows | two columns (left wider) | stacked full-width |
| Heatmap | fits card | horizontally scrollable (`min-width`) |
| Trades table | full table | horizontally scrollable (`Table.ScrollContainer`) |

### Responsive decisions

- The **filter panel** is the bulkiest control block, so on mobile it starts
  **collapsed** (`Collapse` closed) — the user taps "Filters" to expand. This
  keeps the KPIs and charts above the fold on a phone.
- The **heatmap** is a 7×24 grid; 24 hour-columns can't shrink below legibility,
  so it **scrolls horizontally** inside its card rather than reflowing.
- KPI main goes **4 → 2 cols**; the secondary grid (auto-fit) also lands on 2,
  keeping monospace values like `+8.20R` readable.

### Empty-state decision

The empty page keeps the **page header and the filter panel** (the user reached
"no results" *because* of their filters, so they need the controls to loosen
them). The body becomes a single centered `.empty-state` card — icon, "No trades
match these filters", guidance, and a primary **"Reset filters"** CTA. This is
the "no trades match filters" case the issue calls out, distinct from a
brand-new account with zero trades (handled by the Dashboard empty state,
issue #72).

### Chart-as-stand-in decision (static file)

The real charts are Recharts. In a static mockup we hand-author CSS/SVG
equivalents so reviewers see the exact layout, density and color treatment
without a JS runtime: a CSS-grid heatmap, CSS horizontal bars, a CSS histogram,
and an inline-SVG area chart. Each chart card carries a `.note` mapping it to its
Recharts component and backend field.

---

## Sample data (internally consistent)

One trader, Jan–Jun 2026, **84 trades**, all figures reconcile.

### KPI cards
| Card | Value | Rule applied |
|------|-------|--------------|
| Total Trades | `84` | count — not colored (50 W / 30 L / 4 BE) |
| Total P&L (R) | `+49.00R` | sum → positive → green |
| Win Rate | `59.52%` | 50 / 84 → ≥50% → green |
| Profit Factor | `2.36` | gross win 85.0 / gross loss 36.0 → ≥1.5 → green |
| Avg P&L (R) | `+0.58R` | 49.00 / 84 |
| Avg Win (R) | `+1.70R` | 85.0 / 50 |
| Avg Loss (R) | `-1.20R` | −36.0 / 30 |
| Expectancy (R) | `+0.58R` | matches Avg P&L |
| Avg Duration | `4h 12m` | — |
| Best / Worst | `+8.20R / -3.10R` | both appear in the table (GOLD, US30) |
| Win / Loss Streak | `7 / 4` | longest run of each |

`gross_win − gross_loss = 85.0 − 36.0 = 49.0R` = Total P&L = the curve's final
point.

### Asset breakdown (`by_asset`)
| Asset | Trades | Win rate | Total R |
|-------|--------|----------|---------|
| EUR/USD | 22 | 63.6% | +18.40 |
| US100 | 16 | 56.3% | +12.10 |
| GBP/USD | 14 | 64.3% | +9.80 |
| GOLD | 12 | 50.0% | +6.40 |
| US30 | 11 | 54.5% | +4.30 |
| USD/JPY | 9 | 44.4% | −2.00 |

Trades sum to **84**; totals sum to **+49.00R** (matches Total P&L). USD/JPY is
the one red (net-losing) asset.

### Tag breakdown (`by_tag`)
| Tag | Trades | Win rate | Total R |
|-----|--------|----------|---------|
| Breakout | 28 | 67.9% | +24.10 |
| Pullback | 24 | 58.3% | +14.20 |
| Reversal | 18 | 50.0% | +6.30 |
| News | 10 | 40.0% | −2.80 |

Tags overlap (a trade can carry several), so per-tag totals do **not** sum to the
overall P&L. News is the one losing tag (red bar).

### R-distribution (`r_distribution`, 0.5R buckets)
Counts: `1, 1, 2, 3, 5, 8, 10` (loss/breakeven buckets, red) then
`9, 11, 9, 8, 6, 4, 3` (winning buckets, green) — left-skewed mass on the small
positive side, longer winning tail, dashed zero line at 0R.

### Cumulative R curve (`cumulative_r`)
18 sampled points rising from 0 to **+49.00R** with mid-run pullbacks; stays
above zero throughout, so the area fill is entirely green above the dashed 0R
line.

### Trades table (page 1)
First 12 of the 84 trades, date desc; Best `+8.20R` (GOLD) and Worst `-3.10R`
(US30) both visible. Pagination shows **1–20 of 84** (5 pages).

---

## Backend mapping

| Endpoint | Used by |
|----------|---------|
| `GET /api/analytics/statistics` | KPI cards (`statistics.*`) + filter options (`available_filters.*`) |
| `GET /api/analytics/breakdowns` | the four charts + cumulative curve (`by_day_hour`, `by_asset`, `r_distribution`, `by_tag`, `cumulative_r`) |
| `GET /api/analytics/trades` | trades table + pagination (`trades[]`, `pagination`) |

All three accept the same filter query params (see `filter_params` in
`backend/app/routers/analytics.py`); changing any filter refetches all three.

---

## Open question for the implementer

`statistics.win_rate` is computed server-side — confirm whether it's
`winning / total` (used here: 50/84 = 59.52%) or `winning / (winning+losing)`
(50/80 = 62.5%) before wiring the threshold color.

---

## Acceptance-criteria & deliverables checklist

### Issue requirements
- [x] **Page header** — "Analytics" title + dimmed subtitle.
- [x] **Filter panel** — collapsible, responsive grid; all 11 filter groups present with correct components and data sources; "Reset filters" subtle button; note on dynamic/disabled options.
- [x] **KPI main row** — Total Trades, Total P&L (R), Win Rate, Profit Factor (4 prominent cards).
- [x] **KPI secondary row** — Avg P&L, Avg Win, Avg Loss, Expectancy, Avg Duration, Best/Worst combined, Win/Loss streak combined.
- [x] **R-values monospace**; P&L semantic colors per DESIGN_SYSTEM.
- [x] **Charts row 1** — Day-Hour heatmap (wider) + Asset breakdown.
- [x] **Charts row 2** — R-distribution histogram (wider) + Tag breakdown.
- [x] **Charts row 3** — full-width Cumulative R curve with dashed zero line + area fill.
- [x] **Recharts note** — each chart card maps to its Recharts component + backend field.
- [x] **Trades table** — `fz="sm"`, `verticalSpacing="xs"`, all 8 columns, badges, semantic monospace P&L, 20/page pagination, clickable rows, date desc default.
- [x] **Empty state** — "no trades match filters" message + illustration + reset CTA.
- [x] **Loading state** — `.skeleton` helper + documented usage.
- [x] **Mobile responsive** — filters collapse, charts stack, table/heatmap scroll horizontally.
- [x] **Consistent** with existing pages (shared base CSS from issue-72).

### Design-system compliance
- [x] Mantine dark theme tokens; semantic green=profit / red=loss / dimmed=neutral.
- [x] Green/red only for P&L/R and win-rate / profit-factor thresholds (not counts/durations).
- [x] Monospace for all financial numbers; right-aligned + signed in the table.
- [x] Direction teal/grape, tags cyan, emotions indigo (all non-semantic).
- [x] Charts breathe (heatmap, ≥240px histogram, ≥260px curve); axis/grid use `--border` / `--dimmed`.
- [x] Empty + loading states designed (not blank screens).
- [x] No inline styles for theme values — only data-driven geometry (bar widths/heights, SVG points) uses `style`; 2-space indentation.

### Deliverables
- [x] Desktop populated — `analytics.html`.
- [x] Desktop empty — `analytics-empty.html`.
- [x] Mobile populated — `analytics-mobile.html`.
- [x] Self-contained stylesheet (issue-72 base + ISSUE #83 ADDITIONS) — `kiroku-mockup.css`.
- [x] Component mapping + color usage + responsive notes + sample data + checklist — this README.
