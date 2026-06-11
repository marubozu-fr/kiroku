# Issue #102 — Projections page (mockup)

Static HTML/CSS mockups for the **Projections** page — Kiroku's forward-looking
view. M5 replaces TraderPro's three deterministic projection lines with a
statistically correct **Monte Carlo fan chart** that shows confidence intervals
widening over the calendar year. Top to bottom: page header, a collapsible
**Filter panel** (Start Date / Asset / Goal), a **5-up Stats row**, the
centerpiece **fan chart** (actual cumulative R + projected percentile bands +
goal line) with a legend, and a collapsible **Methodology** explainer.

No React, no build. Structure mirrors Mantine + Recharts 1:1 so the
`frontend-dev` agent can translate directly. Colors/spacing come from
`kiroku-mockup.css` CSS variables that mirror Mantine's dark theme — in the real
app these are Mantine tokens (`var(--mantine-color-*)`), never hardcoded.

Reference: `docs/DESIGN_SYSTEM.md`. Base tokens/components copied verbatim from
`docs/mockups/issue-83/kiroku-mockup.css` (this folder is self-contained — no
cross-folder imports); projections-specific styles added below the
`ISSUE #102 ADDITIONS` banner in the CSS.

> The issue references TraderPro's `app/templates/projections/index.html` +
> `app/static/webapp/scripts/projections.js`. Those files are **not** in this
> repo, so this mockup is designed from the issue spec and the established Kiroku
> mockup conventions (issue-83).

## Files

| File | Purpose |
|------|---------|
| `projections.html` | Desktop (≥1200px) — POPULATED with realistic, internally-consistent data |
| `projections-empty.html` | Desktop — EMPTY state (brand-new account, no trades exist yet) |
| `projections-mobile.html` | Mobile (≤768px) — populated, wrapped in a ~390px phone frame to show stacking |
| `kiroku-mockup.css` | Shared theme tokens + base components (from issue-83) + projections styles |

Open the HTML files directly in a browser. Resize `projections.html` below
~768px (Mantine `sm`) to see the stats row collapse to 2 columns, the fan chart
shorten, and the filter grid go single-column; `projections-mobile.html` is
pre-framed to phone width with the chart stacked above the stats.

---

## Component mapping (UI element → Mantine component)

### Layout & header
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| App shell / navbar | `AppShell` + `AppShell.Navbar` | "Projections" link active |
| Page header | `Stack gap={2}` → `Title order={2}` + `Text c="dimmed"` | title + dimmed subtitle |

### Filter panel
| UI element | Mantine component | Data source / param |
|------------|-------------------|---------------------|
| Panel container | `Card` + `Collapse` (toggled by header) | collapsible; open on desktop, collapsed on mobile |
| Panel header | `Group` + chevron `ActionIcon` + active-count `Badge` | "Filters · N active" |
| Filter grid | `SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}` | responsive auto-fill |
| Start Date | `DatePickerInput` | `start_date` — trims the historical sampling window |
| Assets | `MultiSelect` | `asset_ids` — what-if analysis (empty = all assets) |
| Goal (R) | `NumberInput ff="monospace"` | `goal_r` — optional annual R target (drives goal line + `goal_probability`) |
| Reset | `Button variant="subtle"` | clears all params |

Changing any filter re-runs the simulation
(`GET /api/projections?start_date=&asset_ids=&goal_r=`).

### Stats cards (5-up)
| UI element | Mantine component | Color rule |
|------------|-------------------|-----------|
| Row | `SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}` of `Card` | compact |
| Expectancy (R) | shared `<RValue>` (`Text ff="monospace"`) | **semantic** green ≥0 / red <0 (money) |
| Win Rate | `Text ff="monospace"` | green ≥50% / red <50% threshold |
| Std Deviation (R) | `Text ff="monospace"` | **neutral bright** — dispersion, not money → never green/red (`.val.dispersion`) |
| Goal Probability | `Text ff="monospace"` | **neutral** — a probability, not money; rendered **only when `goal_r` is set** |
| Risk of Ruin | `Text ff="monospace"` | **neutral**; `.val.ror.warn` tints **orange** above a danger threshold (NOT red — red is reserved for realised loss) |

### Fan chart (Recharts)
| UI element | Recharts | Mockup stand-in |
|------------|----------|-----------------|
| Container | `ComposedChart` (`ResponsiveContainer`, height ≥340) | inline `<svg>` `.fan-svg` |
| Actual cumulative R | `Area` (green fill) + `Line` (green) | `.fan-actual-area` + `.fan-actual-line` (Jan → now) |
| Now marker | `Dot` / `ReferenceDot` | `.fan-now-marker` circle at actual endpoint |
| Now divider | `ReferenceLine x={current_month}` | `.fan-now` dashed vertical + "now" label |
| Projection P10–P90 | `Area` (light blue) | `.fan-band-outer` polygon (widens to Dec) |
| Projection P25–P75 | `Area` (saturated blue) | `.fan-band-inner` polygon (widens to Dec) |
| Projection P50 | `Line` (solid blue) | `.fan-p50-line` polyline |
| Goal line | `ReferenceLine y={goal_r}` (amber dashed + label) | `.fan-goal` + `.fan-goal-lbl` |
| Zero line | `ReferenceLine y={0}` (dashed) | `.fan-zero` |
| Axes | `XAxis` (months) + `YAxis` (R) | `.fan-axis-lbl` `<text>` |
| Legend | `Legend` | `.fan-legend` swatches/lines |
| Data source | — | `actual[]`, `projection.{p10,p25,p50,p75,p90}[]`, `goal_r`, `current_month` |

### Methodology
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Container | `Card` + `Collapse` | open on desktop, collapsed on mobile |
| Header | `Group` + chevron | "How this projection works" |
| Body | `Text` + ordered `List` + inline `Code` | plain-language Monte Carlo explainer |

### Empty state (brand-new account)
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Intro card | `Card` → `.empty-state` | icon + "No trades to project yet" + primary CTA |
| CTA | `Button variant="filled"` | "+ Add your first trade" → `/journal/new` |
| Preview grid | `SimpleGrid cols={{ base: 1, sm: 3 }}` of `Card` | three feature-preview cards |
| Fan-chart preview | inline `<svg>` (faded) | mini illustration of the fan |

### States
| State | Treatment |
|-------|-----------|
| Loading | `Skeleton` for stat values + a `.skeleton.block` for the chart (`.skeleton` helper in CSS) |
| Empty | `projections-empty.html` — brand-new account; filters/stats/chart replaced by intro card + feature previews + CTA |
| Error | orange notification with retry (per DESIGN_SYSTEM "States") |
| Populated | `projections.html` |

---

## Color usage (per DESIGN_SYSTEM.md)

| Use | Token | Where |
|-----|-------|-------|
| Profit / positive R | `green.6` | Expectancy ≥0, Win Rate ≥50%, **actual** cumulative-R area + line |
| Loss / negative R | `red.6` | Expectancy <0, Win Rate <50% (and the actual line would turn red if cumulative R dipped below 0R, per the merged R-curve behaviour) |
| Neutral / no-data / non-money | `dimmed` / bright default | Std Deviation, Goal Probability, Risk of Ruin, axis/grid labels, "now" marker label |
| **Projection — median** | `blue.6` | P50 line + endpoint callout |
| **Projection — inner band** | `blue.6 @ 0.22 alpha` | P25–P75 fill |
| **Projection — outer band** | `blue.6 @ 0.10 alpha` | P10–P90 fill |
| Goal line | `yellow`/amber `.6` | dashed `ReferenceLine` + "Goal +40R" label |
| Risk-of-ruin danger | `orange` | `.val.ror.warn` only above the danger threshold |
| Brand / primary | `blue.6` | active nav, filter focus ring, primary CTA, active-filter count badge |

**Palette decision — actual vs projected.** This is the page's defining
constraint. **Actual** (realised) data uses the semantic **green/red** from the
design system. **Projected** (estimated) data uses a distinct **blue family**
(the app's primary/brand hue) for P50 + both bands, so a single glance separates
"this happened" from "this is a model". Blue carries **no financial semantic**
here — it only means "estimate". The **goal** line uses **amber** so it never
collides with green (profit), red (loss) or blue (projection). Std Deviation,
Goal Probability and Risk of Ruin are **not money**, so they are neutral bright
text — never green/red.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS emulates Mantine
responsive props at `max-width: 768px`.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger drawer (`AppShell` collapsed) |
| Filter panel | open, 4-col grid | **collapsed** by default; grid → 1 col when opened |
| Stats row | `cols={5}` | `cols={2}` |
| Layout order | filters → stats → chart → methodology | filters → **chart** → stats → methodology |
| Fan chart | 340px tall, full width | 280px tall, full width, stacked **above** stats |
| Methodology | open | **collapsed** by default |

### Responsive decisions

- On mobile the **fan chart moves above the stats**: the chart is the reason a
  trader opens this page, so it gets the top of the viewport; the stat cards
  follow (4→2 → here 5→2 cols).
- The **filter panel** and **methodology** both start **collapsed** on mobile to
  keep the chart above the fold (same rationale as the issue-83 filter panel).
- The fan chart shortens (340 → 280px) but keeps `preserveAspectRatio="none"` so
  it always fills its card width; month labels thin out to Jan/Apr/Jul/Oct/Dec.

### Empty-state decision

The empty page is the **brand-new-account** case (zero trades) — there is no
edge to sample, so the filters, stats row and fan chart are **removed entirely**
and replaced by an intro `.empty-state` card (icon + message + primary
**"Add your first trade"** CTA) followed by three **feature-preview cards** (fan
chart, goal/ruin odds, edge statistics). This is explicitly **distinct** from a
*filter-empty* case (trades exist but none match the filters), which would keep
the filter panel and show a "widen your filters" message like the Analytics page
(issue #83).

### Chart-as-stand-in decision (static file)

The real fan chart is a Recharts `ComposedChart`. In a static mockup we
hand-author an inline-`<svg>` equivalent so reviewers see the exact layout,
widening bands and color treatment without a JS runtime. The SVG geometry was
generated from the sample data below (see "SVG geometry"). The chart card carries
a `.note` mapping every layer to its Recharts component and backend field.

---

## Sample data (internally consistent)

One trader, calendar year **2026**, "now" = **mid-June** (today 2026-06-11).

### Edge (drives everything)
| Stat | Value | Notes |
|------|-------|-------|
| Trades to date | `120` | ~10 trades / month over Jan–mid-June |
| Win rate | `55.0%` | 66 W / 54 L (≥50% → green) |
| Expectancy | `+0.28R` / trade | positive → green |
| Std Deviation | `1.95R` / trade | dispersion → neutral |

### Actual cumulative R (Jan → now)
Month-end values, ending at **+18.4R** at "now":

| Point | Jan | Feb | Mar | Apr | May | now (mid-Jun) |
|-------|-----|-----|-----|-----|-----|---------------|
| Cum. R | +2.6 | +1.2 | +6.4 | +10.8 | +15.9 | **+18.4** |

The actual line ends exactly where the fan begins (**+18.4R**) — that endpoint
is the `now` marker and the apex of every projection band.

### Projection (Monte Carlo, now → Dec)
~`65` remaining trades (10/month × 6.5 months). Mean drift =
`0.28R × 65 ≈ +18.2R` on top of +18.4R → **P50 year-end ≈ +36.6R**. Per-trade σ
of 1.95R gives a band half-width that grows with √(remaining trades), so the fan
**widens** every month:

| Month-end | P10 | P25 | P50 | P75 | P90 | band σ |
|-----------|-----|-----|-----|-----|-----|--------|
| Jul | +12.9 | +17.5 | +22.6 | +27.7 | +32.3 | 7.6 |
| Aug | +12.9 | +18.8 | +25.4 | +32.0 | +37.9 | 9.8 |
| Sep | +13.4 | +20.4 | +28.2 | +36.0 | +43.0 | 11.5 |
| Oct | +14.2 | +22.2 | +31.0 | +39.8 | +47.8 | 13.1 |
| Nov | +15.3 | +24.0 | +33.8 | +43.6 | +52.3 | 14.5 |
| **Dec** | **+16.5** | **+26.0** | **+36.6** | **+47.2** | **+56.7** | **15.7** |

The P10–P90 spread grows from ~19R (Jul) to ~40R (Dec) — the visible widening.

### Derived stats (reconcile with the year-end distribution)
| Stat | Value | Derivation |
|------|-------|-----------|
| Goal | `+40R` | user input (`goal_r`) |
| Goal Probability | `41%` | P(year-end ≥ +40R) given N(36.6, 15.7²) — goal sits just above P50 |
| Risk of Ruin | `1.0%` | P(year-end < 0R) given N(36.6, 15.7²) — low, since +18.4R is already banked |

Goal +40R lands **just above** the P50 of +36.6R and **inside** the P25–P75
band, which is exactly why the goal probability is a plausible **~41%** (a
coin-flip-ish stretch goal), and why the dashed goal line sits visibly just above
the median line in the chart.

### SVG geometry (how the stand-in was built)
viewBox `0 0 960 320`; plot x∈[60,940], y∈[20,270]; R axis maps −10R→y=270,
+60R→y=20. Month i (0=Jan … 12=Dec) → `x = 60 + 880·(i/12)`; "now" = i=5.5 →
x≈463. R value r → `y = 270 − 250·(r+10)/70`. The actual polyline, P50 polyline
and the two band polygons (forward along the upper percentile, back along the
lower) were computed from the tables above so every pixel traces to the data.

---

## Backend mapping

| Endpoint | Used by |
|----------|---------|
| `GET /api/projections` | everything on the page |

Suggested response shape (for the implementer to confirm against the M5 API):

```
{
  "data": {
    "stats": {
      "expectancy_r": 0.28, "win_rate": 0.55, "std_dev_r": 1.95,
      "goal_probability": 0.41, "risk_of_ruin": 0.010
    },
    "goal_r": 40,
    "current_month": "2026-06",
    "actual": [ { "month": "2026-01", "cum_r": 2.6 }, ... ],
    "projection": [
      { "month": "2026-07", "p10": 12.9, "p25": 17.5, "p50": 22.6, "p75": 27.7, "p90": 32.3 },
      ...
    ]
  },
  "error": null
}
```

Query params: `start_date`, `asset_ids[]`, `goal_r`. `goal_probability` is
present only when `goal_r` is set.

---

## Open questions for the implementer

- **Trade-pace estimate.** Remaining-trade count is derived from historical pace
  (~10/month). Confirm the server uses a trailing window vs the whole history.
- **Win-rate denominator.** Same question as issue-83: `winning / total` vs
  `winning / (winning + losing)` — confirm before wiring the ≥50% threshold color.
- **Risk-of-ruin danger threshold.** `.val.ror.warn` (orange) is meant to trip
  above some level (e.g. >10%). Confirm the threshold with product.
- **Actual line below zero.** If cumulative R ever dips below 0R, should the
  actual line/area switch to red below the 0R line (matching the merged R-curve
  behaviour in `feat(analytics): color cumulative R-curve red below 0R`)? Assumed
  **yes** here.

---

## Acceptance-criteria & deliverables checklist

### Issue requirements
- [x] **Section 1 — Fan chart**: actual green line (Jan→now) + blue projection fan (P50 line, P25–P75 + P10–P90 bands) that **widens** toward Dec + amber dashed **labeled goal line**; axes (months X / R values Y) + legend.
- [x] **Section 2 — Stats row**: Expectancy (mono, semantic), Win Rate (%), Std Deviation (mono, neutral), Goal Probability (% — only when goal set), Risk of Ruin (%).
- [x] **Section 3 — Filters**: collapsible panel with Start Date (DatePicker), Assets (MultiSelect), Goal (NumberInput).
- [x] **Section 4 — Methodology**: collapsible plain-language Monte Carlo explainer (sample R-multiples → N simulations → percentile bands).
- [x] **Section 5 — Empty state**: brand-new account; feature-preview cards + primary CTA (`projections-empty.html`).
- [x] **Section 6 — Responsive**: desktop full-width chart + stats + filters; mobile chart stacks above stats, filters/methodology collapse (`projections-mobile.html`).

### Design-system compliance
- [x] Mantine dark theme tokens; semantic green=profit / red=loss for **actual**, blue family for **projected**, amber for goal.
- [x] All financial numbers (R values, expectancy) in monospace.
- [x] Std Deviation / Goal Probability / Risk of Ruin not green/red (not money).
- [x] Goal line dashed + labeled; distinct from every series.
- [x] Each chart/stand-in carries a `.note` mapping it to its Recharts component + backend field.
- [x] Charts breathe (≥340px desktop / 280px mobile); axis/grid use `--border` / `--dimmed`.
- [x] Empty + loading states designed (not blank screens).
- [x] No inline styles for theme values — only data-driven geometry (SVG points, band widths) uses `style`/attributes; 2-space indentation.

### Deliverables
- [x] Desktop populated — `projections.html`.
- [x] Desktop empty (brand-new account) — `projections-empty.html`.
- [x] Mobile populated — `projections-mobile.html`.
- [x] Self-contained stylesheet (issue-83 base + ISSUE #102 ADDITIONS) — `kiroku-mockup.css`.
- [x] Component mapping + color usage + responsive notes + sample data + checklist — this README.
