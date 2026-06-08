# Kiroku — App-Wide UI Design Spec

> **Status:** Living spec. Source of truth for all page-level frontend work.
> **Scope:** App shell, shared component patterns, per-page layouts, state matrix,
> and the color/typography map.
> **Companion docs:** [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) (visual rules),
> [`CLAUDE.md`](../../CLAUDE.md) (conventions), [`docs/KIROKU_ROADMAP.md`](../KIROKU_ROADMAP.md) (milestones).

This document tells the `frontend-dev` agent **what to build** for each page and
**which Mantine components to use**. It does not contain implementation code.

## Ground rules (read first)

1. **Mantine first.** Use a Mantine component for everything it covers. Only write a
   CSS Module class when Mantine has no suitable primitive. Never inline styles,
   never Tailwind, never styled-components.
2. **Dark theme is default**, light mode must work too. Never hardcode hex colors —
   use Mantine theme tokens (`var(--mantine-color-*)`) and the semantic helpers below.
3. **Semantic colors are reserved.** Green = profit / win. Red = loss. Orange = form
   errors and `Warning` severity. See [Color & typography map](#5-color--typography-map).
4. **Financial numbers are monospace, right-aligned, signed.** Always.
5. **Every data view handles four states:** loading, empty, error, populated.
   See the [State matrix](#4-state-matrix).
6. **Snake_case at the API boundary, camelCase inside TS.** Map at the service layer.
7. **Data density over whitespace.** Tables `size="sm"`, cards `padding="md"`.

---

## Table of contents

1. [App shell spec](#1-app-shell-spec)
2. [Component library](#2-component-library)
3. [Page specs](#3-page-specs)
   - [Settings (M1)](#31-settings-m1)
   - [Journal — trade list (M2)](#32-journal--trade-list-m2)
   - [Trade form — add/edit (M2)](#33-trade-form--addedit-m2)
   - [Trade detail (M2)](#34-trade-detail-m2)
   - [Dashboard (M3)](#35-dashboard-m3)
   - [Analytics (M4)](#36-analytics-m4)
   - [Projections (M5)](#37-projections-m5)
4. [State matrix](#4-state-matrix)
5. [Color & typography map](#5-color--typography-map)
6. [Responsive breakpoints](#6-responsive-breakpoints)

---

## 1. App shell spec

The shell already exists at `frontend/src/components/AppLayout/AppLayout.tsx` and is the
**canonical** layout. This section documents it so pages slot into it consistently; do
not redesign it.

### Structure

Mantine `AppShell` with a fixed header, a collapsible navbar, and a centered main area.

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER  (height 56)                                           │
│ [≡] 記録 Kiroku                                    [☀/🌙]      │
├───────────────┬──────────────────────────────────────────────┤
│ NAVBAR (240)  │ MAIN  (padding md)                            │
│               │   ┌────────────────────────────────────────┐ │
│ ▣ Dashboard   │   │  Box  maw={1400}  mx="auto"            │ │
│ ▤ Journal     │   │                                        │ │
│ ▥ Analytics   │   │  <Outlet />  ← page renders here       │ │
│ ▦ Projections │   │                                        │ │
│ ⚙ Settings    │   │                                        │ │
│               │   └────────────────────────────────────────┘ │
└───────────────┴──────────────────────────────────────────────┘
```

### Header

| Element | Component | Notes |
|---------|-----------|-------|
| Mobile burger | `Burger` `hiddenFrom="sm"` | Toggles navbar drawer on mobile |
| Desktop burger | `Burger` `visibleFrom="sm"` | Collapses navbar on desktop |
| Logo / title | `Title order={4}` | `記録` + dimmed `Kiroku` span. No tagline. |
| Color scheme toggle | `ActionIcon variant="default" size="lg"` | `IconSun` in dark mode, `IconMoon` in light. `aria-label="Toggle color scheme"`. |

The header holds **no other global actions**. Page-level actions ("Add trade",
"Add asset") live in the page header row, not the app header.

### Navbar

- Width `240`, `breakpoint="sm"`. Below `sm` it becomes a slide-in drawer toggled by
  the mobile burger; on tap of a nav item the mobile drawer closes.
- Items come from `navItems.ts`: **Dashboard `/`, Journal `/journal`, Analytics
  `/analytics`, Projections `/projections`, Settings `/settings`** — each a Mantine
  `NavLink` with a `@tabler/icons-react` icon (`size={20} stroke={1.5}`).
- **Active state:** Dashboard matches `/` exactly; every other item matches
  `pathname.startsWith(item.path)` so child routes (e.g. `/journal/123`) keep the
  parent highlighted. Use Mantine's `NavLink active` prop — never a custom color.

### Content area

- Wrapped in `<Box maw={1400} mx="auto">`. **Pages never set their own max-width** —
  they fill this box.
- `AppShell` `padding="md"` provides the gutter. Pages start with their content,
  not extra outer padding.
- **Every page opens with a page-header row:** `Title order={2}` on the left, optional
  primary action / controls on the right, using `Group justify="space-between"`.
  Wrap page content in a top-level `<Stack gap="md">` (or `"lg"` for spacious pages).

---

## 2. Component library

Standard patterns every page reuses. When a page section says "standard table" or
"standard modal", it means the pattern defined here.

### 2.1 Page header row

```
Group justify="space-between" align="center"
├─ Title order={2}            // page name, e.g. "Journal"
└─ <right cluster>            // controls + primary Button (optional)
```

On mobile the right cluster wraps below the title (`Group` wraps by default); keep the
primary action first so it stays reachable.

### 2.2 Tables

Use Mantine `Table` inside `Table.ScrollContainer minWidth={…}` so it scrolls
horizontally on small screens.

- Props: `striped`, `highlightOnHover`, `size="sm"`, `verticalSpacing="xs"`.
- **Header cells:** `tt="uppercase"`, `size="xs"`, `c="dimmed"`, `fw={600}`.
- **Numeric columns:** monospace (`ff="monospace"`), right-aligned (`ta="right"`).
  Text columns left-aligned. Badges/centered status columns may center.
- **Row click:** when rows navigate (e.g. trades → detail), set `style={{ cursor: 'pointer' }}`
  on `Table.Tr` and an `onClick`. Keep genuinely interactive controls (toggles, edit
  buttons) in a trailing **Actions** column and `stopPropagation` on them.
- **Sorting:** clickable `Table.Th` with an `IconChevronUp` / `IconChevronDown` /
  `IconSelector` indicator; sort state lives in the page, not the table.

### 2.3 Modals

Mantine `Modal`.

- `size="md"` for forms, `size="lg"` for the trade form's wider layout, `size="xl"` or
  `fullScreen` only for the screenshot lightbox.
- `centered`, `title` set to the action (e.g. "Add asset" / "Edit tag").
- `closeOnClickOutside={false}` for forms with unsaved input; rely on the header close
  (×) and an explicit Cancel button.
- **Footer:** right-aligned `Group justify="flex-end"` with secondary `Cancel`
  (`variant="default"`) then primary submit (`variant="filled"`). Destructive confirm
  modals use a red filled confirm button.

### 2.4 Forms

Always `useForm` from `@mantine/form`.

- **Labels above inputs.** Required fields use Mantine's `withAsterisk`.
- **Per-field errors** render under the field automatically via `form.errors`; they
  appear in **orange** (Mantine's default input error color is fine — do not switch it
  to red). Keep messages short ("Name is required", "Must be greater than 0").
- **Form-level errors** (e.g. a failed submit) show as a Mantine `Alert color="orange"`
  at the top of the form body, plus a `Notifications` toast for transport failures.
- Group related fields with `SimpleGrid` (2 columns desktop, 1 mobile) or `Group`.
  Section separators use a small `Divider` with a `label`.
- Disable the submit button and show a button loader (`loading` prop) while submitting.

### 2.5 Badges

One badge vocabulary across the whole app. All use Mantine `Badge size="sm"` (or `"xs"`
in dense tables), `variant="light"` unless noted.

| Badge | Values → color | Notes |
|-------|----------------|-------|
| **Direction** | `Long` → `teal`, `Short` → `grape` | Neutral hues — **not** green/red, those are reserved for P&L. |
| **Status** | `Open` → `blue`, `Closed` → `gray`, `Partial` → `yellow`, `Breakeven` → `gray` (dimmed) | |
| **Severity** (emotions) | `Good` → `green`, `Warning` → `orange`, `Bad` → `red` | **Documented exception** — see note below. |
| **Category** (asset / emotion) | `variant="outline"`, `color="gray"` | Informational grouping only; keep it quiet. |

> **Severity exception (must be ratified in `DESIGN_SYSTEM.md`).** The roadmap (issue #8)
> mandates `Good`→green / `Warning`→orange / `Bad`→red for emotion severity. This reuses
> green and red outside their reserved P&L meaning. It is intentional and scoped **only**
> to the emotion severity badge, but `DESIGN_SYSTEM.md` currently states green/red have
> "no exceptions" — that doc should be updated to record this carve-out before
> implementation, otherwise the spec contradicts its own source of truth. Severity badges
> never appear in the same cell as a P&L/R number, so the visual collision risk is low.

Centralize this in a small `Badge` wrapper or a `badgeColor(kind, value)` helper so
colors never drift. Direction and P&L color must stay visually distinct.

### 2.6 Cards

- **Metric card** (Dashboard / Analytics stat tiles): Mantine `Card shadow="sm"
  radius="md" padding="md"`. Layout: dimmed `Text size="sm"` label on top, then the
  value `Text size="xl" fw={700} ff="monospace"` (semantic color for P&L), optional
  small delta/subtext line. Lay tiles out with `SimpleGrid`.
- **Content card** (Open positions, Recent trades, sections of Trade detail): same
  `Card` with a header row (`Group justify="space-between"` → section title + optional
  link/action), `Card.Section` divider, then the body.

### 2.7 Financial number

A single shared `<Money>` / `<RValue>` helper renders all prices, P&L, percentages, and
R values:

- Monospace, right-aligned in table cells.
- P&L and R: signed (`+125.00`, `-42.50`), colored green/red, neutral (`dimmed`) at zero.
- Raw prices (entry/exit) are monospace but **not** semantically colored.
- Percentages append `%`; R values append `R`.

### 2.8 States (shared treatments)

| State | Treatment |
|-------|-----------|
| **Loading** | Mantine `Skeleton` matching the final shape (table rows, card grid, chart block). No spinners for page content. |
| **Empty** | Centered block: dimmed `@tabler` icon (~48px), a one-line message, and a primary CTA when an action makes sense ("Add your first trade"). Never a blank screen. |
| **Error** | Inline `Alert color="orange"` with the message and a `Retry` button for the failed fetch; transient/action failures additionally fire a Mantine `Notifications` toast (orange). |
| **Populated** | The normal view below. |

See the [State matrix](#4-state-matrix) for the per-page specifics.

---

## 3. Page specs

Each page follows: page-header row → content in a `Stack`. Component trees below name
Mantine components; fields are grounded in the API models in `backend/app/models/`.

### 3.1 Settings (M1)

**Route:** `/settings` · **Milestone:** M1 · **Purpose:** manage reference data.

```
Stack
├─ Title order={2}  "Settings"
└─ Tabs (default "assets")
   ├─ Tabs.List:  Assets | Tags | Emotions
   ├─ Tab: Assets
   │   ├─ Group justify="space-between":  (filter "Show inactive" Switch) · Button "Add asset"
   │   └─ Table.ScrollContainer → Table
   │        cols: Name | Category(badge) | Currency | Active(Switch) | Actions(edit)
   ├─ Tab: Tags
   │   ├─ Group:  Button "Add tag"
   │   └─ Table: Name | Description(truncated) | Active(Switch) | Actions(edit)
   └─ Tab: Emotions
       ├─ Group:  Button "Add emotion"
       └─ Accordion or grouped sections by category
            each row: Name | Severity(badge) | Description(truncated) | Actions(edit, delete)
```

**Assets tab**
- Columns: **Name**, **Category** (outline badge), **Currency** (monospace, dimmed if
  null), **Active** (`Switch` toggling `is_active` via `PUT`/`DELETE`), **Actions**
  (edit `ActionIcon`).
- Add/Edit modal (`size="md"`): `TextInput` Name (required, 2–50), `Select` Category
  (`Forex, Crypto, Stock, ETF, Indices`, required), `TextInput` Currency (optional).
- Deactivated assets appear **dimmed** (`c="dimmed"` row text, badge `variant="outline"`)
  and only when "Show inactive" is on. Soft delete = set `is_active=false`.

**Tags tab**
- Columns: **Name**, **Description** (`Text lineClamp={1}` with full text in `title`),
  **Active** (`Switch`), **Actions** (edit).
- Modal: `TextInput` Name (3–100, required), `Textarea` Description (optional, ≤500).
- Soft delete like assets.

**Emotions tab**
- **Grouped by category** (the five: Emotional State, Mental Triggers, Focus & Clarity,
  Execution Confidence, Why This Trade?). Use an `Accordion` (one item per category) or
  labelled `Divider` sections. Consume `GET /api/emotions/grouped`.
- Each row: **Name**, **Severity** badge (Good=green / Warning=orange / Bad=red),
  **Description** (clamped), **Actions** (edit, delete).
- Modal: `TextInput` Name (3–100), `Textarea` Description, `Select` Severity, `Select`
  Category. **Emotions are hard-deleted** (no `is_active`) — confirm with a destructive
  modal.

**States:** skeleton table rows while loading; per-tab empty state ("No assets yet —
add one to start tagging trades.") with the Add CTA; orange `Alert` + retry on fetch
error; toast on save/delete success and failure.

---

### 3.2 Journal — trade list (M2)

**Route:** `/journal` · **Milestone:** M2 · **Purpose:** browse and open trades.

```
Stack
├─ Group justify="space-between":
│    ├─ Title order={2} "Journal"
│    └─ Group:  SegmentedControl/Select (year)  ·  Button "Add trade" (→ /journal/new)
└─ Table.ScrollContainer minWidth={760} → Table (striped, highlightOnHover, size sm)
     Date | Asset | Direction | Status | Entry | Exit | Risk % | R | P&L
     row onClick → /journal/{id}
```

**Year selector**
- `SegmentedControl` when there are few years; switch to `Select` if the list is long.
- Options from `GET /api/trades/years`; default to the most recent year.

**Columns** (grounded in `TradeSummary`)

| Column | Source | Align / format |
|--------|--------|----------------|
| Date | `trade_date` | left, `YYYY-MM-DD` |
| Asset | `asset_id` → name | left |
| Direction | `direction` | center, Direction badge (teal/grape) |
| Status | `status` | center, Status badge |
| Entry | `avg_entry_price` | right, monospace |
| Exit | `avg_exit_price` | right, monospace (dimmed `—` if open) |
| Risk % | `risk_per_trade` | right, monospace, `%` |
| R | `performance_r` | right, monospace, signed, **semantic color**, `R` suffix |
| P&L | derived (see note) | right, monospace, signed, **semantic color** |

> **P&L sourcing.** `TradeSummary`/`TradeResponse` currently expose `risk`, `reward`, and
> `performance_r` but **no monetary P&L field**. Before any page that shows a P&L number
> is built, P&L must either be added as a computed field on the trade API, or derived
> client-side from `activities` (signed by `direction`: realized proceeds − cost over
> matched buy/sell quantity). This is a **backend dependency**, not something the spec can
> assume exists. Until resolved, treat every "P&L" cell/card below as gated on it.

- Direction may be `null` (`TradeSummary.direction` is optional) for trades with no
  resolved side yet — render a dimmed `—` instead of a badge in that case.
- A trade with `missed_opportunity` shows a small dimmed `IconEyeOff` next to the date.
- **Sorting:** Date (default desc), R, and P&L are sortable via clickable headers.
- Optional secondary filters (asset, status, direction) may sit in a `Group` under the
  header for M2; full filtering is the Analytics page's job.

**States**
- **Loading:** 8–10 `Skeleton` rows matching the column widths.
- **Empty (no trades at all):** centered `IconNotebook`, "No trades logged yet",
  primary "Add trade" button.
- **Empty (year has none):** "No trades in {year}." with a hint to switch years.
- **Error:** orange `Alert` + Retry.

---

### 3.3 Trade form — add/edit (M2)

**Route:** `/journal/new` and `/journal/{id}/edit` · **Milestone:** M2.
Maps to `TradeCreate` / `TradeUpdate`. Use a wide modal **or** a dedicated route page —
prefer a **route page** given the form's size; reuse the same form component for both.

```
Stack (max readable width ~720 inside the centered box)
├─ Group justify="space-between":  Title "Add trade" / "Edit trade"  ·  (status badge if editing)
├─ Card: "Instrument"
│    ├─ Select Asset (grouped by category, searchable, required)
│    └─ Group: Select Timeframe unit (M/H/D/W) · NumberInput Timeframe value
├─ Card: "Activities"   ← dynamic list, at least one row required
│    ├─ for each activity row (Group, wraps on mobile):
│    │     Select Type(Buy/Sell) · DateInput Date · NumberInput Price · NumberInput Qty · ActionIcon remove
│    └─ Button variant="light" leftSection=IconPlus  "Add activity"
├─ Card: "Risk"
│    └─ Group: NumberInput "Stop loss" · NumberInput "Risk per trade %"
├─ Card: "Context"
│    ├─ MultiSelect Tags (searchable)
│    ├─ MultiSelect Emotions (grouped by category; option label shows severity badge)
│    └─ Checkbox "Missed opportunity"
├─ Card: "Notes"
│    └─ Textarea Notes (autosize, ≤2000)
└─ Group justify="flex-end":  Button default "Cancel"  ·  Button filled "Save trade"
```

**Asset selector** — Mantine `Select` with grouped data (`group` per asset category),
`searchable`, only active assets. Required.

**Activities dynamic list** — the core widget. Backed by `form.insertListItem` /
`removeListItem`. Each row: **Type** (`Select` Buy/Sell), **Date** (`DateInput`),
**Price** (`NumberInput` > 0), **Quantity** (`NumberInput` > 0), **remove** `ActionIcon`
(`IconTrash`, disabled when only one row remains). "Add activity" appends a row. At least
one activity is required (`activities` `min_length=1`). Rows must remain readable on
mobile — stack the inputs vertically below `sm`.

**Risk section** — `NumberInput` Stop loss (optional, allows decimals) and `NumberInput`
Risk per trade (percent, optional). Computed fields (avg entry/exit, R, P&L) are **never
entered here** — the backend calculates them; show them read-only on the detail view.

**Tags / Emotions** — `MultiSelect`. Emotions grouped by category, with the severity
shown as a colored dot/badge in the option. Both optional.

**Timeframe** — `Select` unit (`M, H, D, W`) + `NumberInput` value (e.g. 15 → "M15").

**Validation display**
- Per-field: orange inline messages from `useForm` validators (required asset, ≥1
  activity, price/qty > 0, notes ≤ 2000).
- Form-level: orange `Alert` at top on submit failure; toast on network error.
- Submit disabled + loading while posting. On success: toast + navigate to the trade
  detail (`/journal/{id}`).

**Cancel** returns to the list (or detail when editing) without saving; warn via a small
confirm if the form is dirty.

---

### 3.4 Trade detail (M2)

**Route:** `/journal/{id}` · **Milestone:** M2. Consumes the full `TradeResponse`.

```
Stack
├─ Group justify="space-between":
│    ├─ Group: Title (Asset name) · Text dimmed (trade_date) · Direction badge · Status badge
│    └─ Group: Button default "Edit" (→ edit)  ·  ActionIcon red "Delete"
├─ SimpleGrid cols={{ base 2, sm 4 }}  ← metrics row (metric cards)
│    P&L · R value · Risk/Reward · Duration
├─ Card "Activities"  ← timeline
│    Timeline: each activity = Buy/Sell · price · qty · date  (entry marked)
├─ Group (SimpleGrid cols={{ base 1, md 2 }}):
│    ├─ Card "Tags"      → Badge group (or empty hint)
│    └─ Card "Emotions"  → Badges grouped by category with severity colors
├─ Card "Notes"  → rendered notes text (empty hint if none)
└─ Card "Screenshots"  → gallery grouped by timeframe, click → lightbox
```

**Header** — asset name (`Title order={2}`), `trade_date` dimmed, Direction badge (omit
when `direction` is null) + Status badge. Right side: `Edit` button and a red `Delete`
`ActionIcon` (`IconTrash`) that
opens a destructive confirm modal ("Delete this trade? This cannot be undone.").

**Metrics row** — four metric cards (`SimpleGrid cols={{ base: 2, sm: 4 }}`):
- **P&L** — derived, signed, semantic color, monospace.
- **R value** — `performance_r`, signed, semantic color, `R` suffix.
- **Risk / Reward** — from `risk` / `reward`, monospace (e.g. `1 : 2.4`).
- **Duration** — first→last activity span. Granularity follows what the activity `date`
  values carry: day-level (e.g. "3d") when they are dates, finer ("3d 4h") only if they
  include a time component. Dimmed "Open" when the trade is not closed.

**Activities timeline** — Mantine `Timeline`, one bullet per activity ordered by date.
Each: Buy/Sell label (small badge), price + quantity (monospace), date. Entry activity
gets a highlighted bullet (`IconLogin`); exits a different icon.

**Tags & emotions** — `Badge` groups. Emotions grouped by category, severity-colored.
Empty hint ("No tags") when none.

**Notes** — plain text in a card, preserving line breaks (`white-space: pre-wrap` via a
CSS Module). Empty hint when blank.

**Screenshots gallery** — `TradeScreenshotResponse[]` grouped by `timeframe_unit`/`value`
(section heading per timeframe, e.g. "H1", "M15"). Thumbnails in a `SimpleGrid`; clicking
opens a **lightbox** (full-screen `Modal` with the image and prev/next). Empty hint when
no screenshots. (Upload UI is out of scope for this spec — display only.)

---

### 3.5 Dashboard (M3)

**Route:** `/` · **Milestone:** M3 · **Purpose:** at-a-glance performance.

```
Stack gap="lg"
├─ Title order={2} "Dashboard"
├─ SimpleGrid cols={{ base 2, sm 3, lg 5 }}  ← metric cards
│    Total trades · Net P&L · Win rate · Profit factor · Expectancy
├─ Card "Equity curve"  ← TradingView Lightweight Charts (line/area), min-height 300
├─ SimpleGrid cols={{ base 1, lg 2 }}:
│    ├─ Card "Monthly performance"  → grid/table: month rows, P&L + R + #trades, colored
│    └─ Card "Open positions"       → compact table of status≠Closed trades
└─ Card "Recent trades"  → last ~8 trades, mini version of the Journal table
```

**Metric cards** (5) — value monospace `size="xl" fw={700}`; **Net P&L** and
**Expectancy** semantic-colored; **Win rate** shows `%`; **Profit factor** plain
monospace. Dimmed label above. NEVER show placeholder numbers — if there is no data, the
whole dashboard shows the empty state below.

**Equity curve** — TradingView Lightweight Charts line/area series, background matched to
the Mantine card background, up = profit green, down = loss red, min-height 300px. Loading
shows a `Skeleton` of the same height.

**Monthly performance** — table or 12-cell grid: each month with net P&L (semantic) and
trade count; blank/dimmed months with no trades.

**Open positions** — compact table (Asset, Direction, Entry, current R if available),
rows link to detail. Empty hint "No open positions."

**Recent trades** — the last ~8 closed/updated trades as a trimmed Journal table; a
"View all" link to `/journal`.

**States** — skeleton cards + chart block while loading; **whole-page empty state** when
there are zero trades ("No data yet — log your first trade", CTA to the trade form, as
the existing placeholder already hints); orange `Alert` + retry on error.

---

### 3.6 Analytics (M4)

**Route:** `/analytics` · **Milestone:** M4 · **Purpose:** slice performance by dimension.

```
Stack gap="lg"
├─ Title order={2} "Analytics"
├─ Card "Filters"  (filter bar)
│    Group wrap: MultiSelect Asset · MultiSelect Tag · Select Direction · Select Status · DatePickerInput range
│    + Button "Apply" / Button variant="subtle" "Reset"
├─ SimpleGrid cols={{ base 2, md 4 }}  ← stat cards (respond to filters)
│    Trades · Win rate · Avg R · Expectancy  (extend as the stats engine grows)
├─ SimpleGrid cols={{ base 1, lg 2 }}:
│    ├─ Card "By asset"  → table/bar: asset, #trades, win%, net R (sortable)
│    └─ Card "By tag"    → table/bar: tag, #trades, win%, net R
├─ Card "Time heatmap"  → day-of-week × hour grid, cell color = net R intensity
└─ Card "Emotion correlation"  → table: emotion (severity badge), #trades, avg R
```

**Filter bar** — Mantine `MultiSelect` (Asset, Tag), `Select` (Direction, Status),
`DatePickerInput type="range"` (date range). Filters are the page's primary control;
keep them in a `Card` so they read as one unit. Active filters reflected in a row of
removable `Chip`/`Badge`s is a nice-to-have. All stats and breakdowns below recompute
from the applied filters.

**Stat cards** — same metric-card pattern; semantic color for R/expectancy.

**Breakdowns (by asset / by tag)** — sortable tables with an optional inline bar
(`Progress` or a small bar) for net R. Right-align and color the R column.

**Time heatmap** — a CSS-grid of cells (day-of-week rows × session-hour columns); cell
background interpolates between loss-red and profit-green by net R, neutral at zero. This
is the one place a small CSS Module is justified (Mantine has no heatmap). Include a
legend.

**Emotion correlation** — table of emotions with severity badge, trade count, and avg R
(semantic). Helps surface which emotional states correlate with losses.

**States** — skeleton stat cards + table/heatmap placeholders; empty state when the
filter set returns nothing ("No trades match these filters", with a Reset CTA); orange
`Alert` + retry on error.

---

### 3.7 Projections (M5)

**Route:** `/projections` · **Milestone:** M5 · **Purpose:** forecast equity forward.

```
Stack gap="lg"
├─ Title order={2} "Projections"
├─ Card "Scenario"  (controls)
│    Group: SegmentedControl scenario (Pessimistic | Base | Optimistic)
│           · NumberInput "Trades / month" · NumberInput "Horizon (months)"
│           · NumberInput "Avg R" (or per-scenario presets)
├─ Card "Projection"  → TradingView chart: real equity (solid) + projected (dashed) bands
└─ SimpleGrid cols={{ base 1, md 2 }}:
     ├─ Card "Real vs projected"  → table: month, real P&L, projected P&L, delta
     └─ Card "Assumptions"        → summary of inputs feeding the scenario
```

**Scenario controls** — `SegmentedControl` for Pessimistic / Base / Optimistic plus
`NumberInput`s for the drivers (trades per month, horizon, average R / win rate). Changing
a control re-runs the projection client-side or via the API.

**Projection chart** — TradingView Lightweight Charts: the **real** equity curve as a
solid line up to today, then **projected** scenarios as dashed lines / a shaded band
(optimistic top, pessimistic bottom). Profit/loss coloring conventions still apply.

**Real vs projected** — table comparing realized vs projected P&L per month with a signed,
semantic-colored delta column.

**States** — skeleton chart + cards; this page needs realized history to anchor the
projection, so the empty state ("Log some trades to project from your real performance")
points back to the journal; orange `Alert` + retry on error. **No invented numbers** —
projections are computed from real history plus the user's explicit scenario inputs only.

---

## 4. State matrix

Every data view must implement all four states. ✓ = applies.

| Page / view | Loading (Skeleton) | Empty | Error (Alert + retry) | Notes |
|-------------|:---:|:---:|:---:|-------|
| Settings — Assets | rows | "No assets yet" + Add | ✓ | toast on save/delete |
| Settings — Tags | rows | "No tags yet" + Add | ✓ | |
| Settings — Emotions | grouped rows | "No emotions yet" + Add | ✓ | hard-delete confirm |
| Journal list | rows | no-trades vs no-trades-this-year | ✓ | |
| Trade form | inputs (edit fetch) | n/a | field + form-level (orange) | dirty-cancel confirm |
| Trade detail | section blocks | per-section hints (no tags / no notes / no screenshots) | ✓ (whole page) | delete confirm |
| Dashboard | cards + chart | whole-page "No data yet" + CTA | ✓ | never placeholder metrics |
| Analytics | cards + tables + heatmap | "No trades match filters" + Reset | ✓ | |
| Projections | chart + cards | "Log trades to project" + CTA | ✓ | computed-only |

**Loading** = Mantine `Skeleton` shaped like the final content (never a bare spinner for
page bodies). **Empty** = dimmed icon + message + CTA when an action fits. **Error** =
inline orange `Alert` with the message and a Retry button; transient action failures also
fire a `Notifications` toast.

---

## 5. Color & typography map

Strictly from `DESIGN_SYSTEM.md`. **No raw hex anywhere** — Mantine tokens only.

### Semantic colors (the only custom semantics)

| Meaning | Token | Used in |
|---------|-------|---------|
| Profit / win / equity up | `green.6` (`profit`) | P&L, R values, win cells, up candles, equity rising |
| Loss / lose / equity down | `red.6` (`loss`) | P&L, R values, loss cells, down candles, equity falling; `Bad` severity |
| Neutral / break-even / no data | `dimmed` | zero P&L, pending, empty hints |
| Form errors | `orange` | field errors, form-level alerts, error notifications |
| Warning severity | `orange` | `Warning` emotion badge |

**Hard rules:** green only ever means money gained; red only ever means money lost. The
**sole** carve-out is the emotion **severity** badge (`Good`→green, `Bad`→red, mandated by
roadmap issue #8 and scoped to that one badge); it must be ratified in `DESIGN_SYSTEM.md`
(see [§2.5](#25-badges)). Form errors are **orange, never red**. Success toasts use
Mantine default, **never green**.

### Badge palette (non-semantic, reserved hues)

Direction: `Long`→teal, `Short`→grape · Status: `Open`→blue, `Partial`→yellow,
`Closed`/`Breakeven`→gray · Category: gray outline. These avoid green/red so they never
collide with P&L meaning.

### Typography

| Use | Spec |
|-----|------|
| Financial numbers (prices, P&L, %, R) | `JetBrains Mono` (`fontFamilyMonospace`, set in `theme/index.ts`); right-aligned in tables; P&L/R always signed |
| Body / labels | Mantine default sans |
| Page title | `Title order={2}` |
| Card metric value | `size="xl" fw={700}` monospace |
| Card / column label | `size="sm"`/`xs`, `c="dimmed"`, table headers uppercased |

All standard backgrounds, borders, text, and input colors come from Mantine's dark/light
theme — **never overridden**.

---

## 6. Responsive breakpoints

Mantine breakpoints (`xs sm md lg xl`). Key behaviors:

| Area | Mobile (`< sm`) | Tablet (`sm–lg`) | Desktop (`≥ lg`) |
|------|-----------------|------------------|------------------|
| Navbar | hamburger drawer | collapsible sidebar | sidebar open |
| Tables | horizontal scroll (`Table.ScrollContainer`) | scroll as needed | full width |
| Metric card grids | `cols={2}` (or 1 for wide values) | `cols={3}` | `cols={4–5}` |
| Trade form rows | inputs stacked vertically | 2-col groups | 2-col groups |
| Analytics breakdowns | 1 col | 1 col | 2 cols |
| Page header right cluster | wraps below title | inline | inline |

Content always sits inside the shell's centered `maw={1400}` box; pages never set their
own max-width or outer padding.

---

*End of spec. Page-level issues (M1–M5) reference the matching section above. When a page
diverges from this document, update the spec in the same PR so it stays the source of
truth.*
