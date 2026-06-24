# Issue #183 — Trade charts UI mockups

Static HTML/CSS mockups for the **trade charts** feature. Three design areas:

1. **Chart panel** in the trade detail page (the main deliverable).
2. **Market data ticker** Autocomplete in the asset create/edit form.
3. **Massive API key** field in Settings → General.

No React, no build, **no production code** — implementation is handled by
subsequent issues. Structure mirrors Mantine 1:1 so the `frontend-dev` agent can
translate directly. Colors/spacing come from `kiroku-mockup.css` CSS variables
that mirror Mantine's dark theme — in the real app these are Mantine tokens
(`var(--mantine-color-*)`), never hardcoded. The base stylesheet is carried over
verbatim from `docs/mockups/issue-178/`; **issue #183 adds chart/ticker/API-key
styles** under the `ISSUE #183 ADDITIONS` banner (the folder is self-contained —
no cross-folder imports).

Reference: `docs/DESIGN_SYSTEM.md`, `docs/designs/APP_DESIGN.md` §3.4 (trade
detail) and §3.1 (Settings → Assets). Open the HTML files directly in a browser.

## Files

| File | Shows |
|------|-------|
| `trade-detail-chart.html` | **Main deliverable** — trade detail header + metrics row + the **populated chart panel**: candlestick series, entry (Buy) / exit (Sell) markers, SL line, two TP lines, timeframe SegmentedControl (default **M15**), legend. |
| `chart-states.html` | The four non-populated chart states stacked: **empty** (no `massive_ticker`), **loading** (skeleton), **data not yet available** (same-day / end-of-day), **error** (request failed). |
| `asset-form-ticker.html` | Edit-asset Modal with the **Market data ticker** Autocomplete in its active search state (typed `EUR`, dropdown of matches, clear button). |
| `asset-form-ticker-linked.html` | Same field in its **resting/linked** state — saved ticker shown as a chip with a × to unlink. |
| `settings-general-api-key.html` | Settings → General with the new **Market data** card holding the **Massive API Key** PasswordInput (show/hide toggle, signup link). |
| `kiroku-mockup.css` | Shared theme tokens + base components (from issue-178) **+ issue-183 additions** (chart, ticker, API-key). |

The candlestick chart is drawn as an inline `<svg>` (declarative geometry, theme
colors via CSS classes — no inline styles). It stands in for the real
**TradingView Lightweight Charts** candlestick series; the mockup's job is the
panel chrome (toolbar, timeframe control, SL/TP line treatment, marker styling,
states), not pixel-faithful candle rendering. The sample series is a winning Long
(entry near a swing low, exit near the high) so every overlay is visible.

---

## Component mapping (UI element → Mantine component)

### 1. Chart panel — `TradeChartPanel` in trade detail (`frontend/src/pages/TradeDetailPage.tsx`)

| UI element | Mantine / lib | Notes |
|------------|---------------|-------|
| Panel container (`.card`) | `Card withBorder padding="md" radius="md"` | sits between the metrics `SimpleGrid` and the Activities card |
| Toolbar (`.chart-toolbar`) | `Group justify="space-between"` | title + ticker/date range on the left, timeframe control on the right |
| Title | `Title order={4}` | `t('trade.chart.title')` → "Price chart" |
| Timeframe selector (`.segmented.tf`) | `SegmentedControl size="xs"` | data `['M1','M5','M15','H1','H4','D1']`; default = trade's entry TF (M15) |
| Chart frame (`.chart-frame`) | `Box` host for the chart | `min-height: 300px` per DESIGN_SYSTEM "Charts"; background = dark body |
| Candlestick series (`.chart-svg`) | **TradingView Lightweight Charts** `addCandlestickSeries` | up = profit green, down = loss red |
| Entry / exit markers | `series.setMarkers([...])` | from trade activities: entry = `position:'belowBar'` blue ▲ "BUY"; exit = `position:'aboveBar'` grape ▼ "SELL" |
| Stop-loss line | `series.createPriceLine({ color: loss, lineStyle: Dashed })` | red, label `SL <price>` |
| Take-profit line(s) | `series.createPriceLine({ color: profit, lineStyle: Dashed })` | green, label `TP1/TP2 <price>`; one or many |
| Legend (`.chart-legend`) | `Group gap="md"` of `Text size="xs" c="dimmed"` | key for the two markers + two lines |

**Data window:** `trade_date − 7d … trade_date + 7d` (issue spec). The chart fetches
candles for the asset's `massive_ticker` at the selected timeframe over that window.

**States** (`chart-states.html`, all inside the same `.chart-frame`):

| State | Trigger | Treatment |
|-------|---------|-----------|
| Empty | asset has no `massive_ticker` | `.empty-state` (chart-off icon) + CTA "Link a ticker" → Settings → Assets |
| Loading | candles being fetched | `.chart-skeleton` (Mantine `Skeleton`), timeframe control disabled |
| Data not yet available | same-day trade (EOD data) | informational `.empty-state` (clock icon), no CTA |
| Error | Massive request failed | `.empty-state.error` (orange triangle) + "Retry" |

### 2. Ticker Autocomplete — asset Modal (`frontend/src/components/settings/AssetFormModal.tsx`)

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Field wrapper | `Autocomplete` | placed **below** Name / Category / Currency |
| Label | `label` | `t('settings.assets.ticker_label')` → "Market data ticker" |
| Description (above input) | `description` | "Links this asset to a Massive ticker so its trades show a price chart." |
| Input + clear (`.input-with-clear`) | `Autocomplete rightSection={CloseButton}` | × clears/unlinks the value |
| Dropdown (`.ac-dropdown` / `.ac-option`) | `Combobox.Option` items | format `C:EURUSD — Euro / United States Dollar`; opens at **2+ chars** |
| Info text (below input) | `Text size="xs" c="dimmed"` | "Optional — enables chart display in trade detail." |
| Linked chip (`.ticker-chip`) | the `Autocomplete` value | resting state when a ticker is saved (`asset-form-ticker-linked.html`) |

Suggestions come from the Massive ticker search endpoint, debounced; an empty
result shows `.ac-empty` ("No matching tickers").

### 3. Massive API key — Settings → General (`frontend/src/components/settings/GeneralTab.tsx`)

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| "Market data" card | `Card withBorder padding="md" radius="md"` | new peer card between Language and Backup |
| Card title | `Title order={4}` | `t('settings.general.market_data')` → "Market data" |
| Key input (`.input-with-toggle`) | `PasswordInput` | `t('settings.general.api_key_label')` → "Massive API Key"; built-in visibility toggle |
| Helper text | `description` with `Anchor` | "Free API key from [massive.com](https://massive.com/dashboard/signup) — enables chart data for trades." |
| Save | `Button size="xs"` | persists via `PATCH /api/preferences` (key stored in DB) |

---

## Color usage (per DESIGN_SYSTEM.md)

The chart is the one place where green/red on **price** is the correct financial
semantic, so the rule is applied deliberately:

| Element | Color | Rationale |
|---------|-------|-----------|
| Candle up / down | profit green / loss red | price rising = gain, falling = loss — the legitimate P&L semantic |
| Take-profit line(s) | profit green | a target is a gain level |
| Stop-loss line | loss red | a stop is a loss level |
| **Entry marker** | **primary blue** | a marker is **not** P&L — kept off green/red so it reads against the candles |
| **Exit marker** | **grape/violet** | distinct from entry; also non-financial |
| Error state icon | orange | DESIGN_SYSTEM "Error" = orange, never red (red is loss/destructive) |

No new hex colors are introduced: blue, grape, green, red and orange all already
exist as `:root` vars mirroring Mantine tokens.

---

## Responsive behavior (Mantine breakpoints)

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Trade detail content | `maw={1000}` centered | full width |
| Metrics row | `SimpleGrid cols={4}` | `cols={2}` |
| Chart toolbar | title left, timeframe right (one row) | wraps to two rows |
| Chart frame | `min-height: 300px`, fluid width | same; SVG scales by viewBox |
| Asset / API-key Modals & cards | as shown | cards full width, Modal near full-width |

The SVG chart scales with its container via `viewBox` (no fixed pixel width).

---

## Proposed i18n keys (EN source of truth — 6 locales)

Implementation issues add these; listed here so copy is settled at design time.
All trading terms (BUY, SELL, SL, TP, M15, C:EURUSD) stay English in every locale
per `docs/I18N_GLOSSARY.md`.

| Key | EN copy |
|-----|---------|
| `trade.chart.title` | Price chart |
| `trade.chart.legend.entry` | Entry (Buy) |
| `trade.chart.legend.exit` | Exit (Sell) |
| `trade.chart.legend.take_profit` | Take profit |
| `trade.chart.legend.stop_loss` | Stop loss |
| `trade.chart.empty.title` | No chart for this asset |
| `trade.chart.empty.description` | Link a market data ticker to {{asset}} in Settings → Assets to display candlestick data here. |
| `trade.chart.empty.cta` | Link a ticker |
| `trade.chart.unavailable.title` | Chart data not yet available |
| `trade.chart.unavailable.description` | End-of-day candles for {{date}} are published after the market closes. Check back tomorrow. |
| `trade.chart.error.title` | Couldn't load chart data |
| `trade.chart.error.description` | Check your Massive API key in Settings → General, then try again. |
| `settings.assets.ticker_label` | Market data ticker |
| `settings.assets.ticker_description` | Links this asset to a Massive ticker so its trades show a price chart. |
| `settings.assets.ticker_info` | Optional — enables chart display in trade detail. |
| `settings.assets.ticker_placeholder` | Type 2+ characters to search… |
| `settings.assets.ticker_empty` | No matching tickers |
| `settings.general.market_data` | Market data |
| `settings.general.api_key_label` | Massive API Key |
| `settings.general.api_key_description` | Free API key from massive.com — enables chart data for trades. |

Reused: `common.actions.save`, `common.actions.cancel`, `common.actions.retry`,
`common.actions.clear`.

---

## Acceptance-criteria & deliverables checklist

Chart panel:
- [x] TradingView Lightweight Charts visual style (dark, candlesticks).
- [x] Candles at the trade's entry timeframe (default M15).
- [x] Entry (Buy) markers and distinct exit (Sell) markers.
- [x] Stop-loss horizontal line (loss red).
- [x] Take-profit horizontal line(s) (profit green) — two shown.
- [x] Window `trade_date − 7d … + 7d` (shown as "May 7 – May 21").
- [x] Empty state when the asset has no `massive_ticker`.
- [x] Loading state (skeleton).
- [x] "Data not yet available" state for same-day trades. (+ error state.)
- [x] Timeframe selector M1/M5/M15/H1/H4/D1, default = entry TF.

Ticker Autocomplete:
- [x] Placed below the existing asset fields.
- [x] Label "Market data ticker" + helper text explaining it enables charts.
- [x] Autocomplete on 2+ chars, format "C:EURUSD — Euro / United States Dollar".
- [x] Clear button to unlink (+ linked chip resting state).
- [x] Info text "Optional — enables chart display in trade detail".

API key:
- [x] Settings → General, label "Massive API Key".
- [x] Password input with show/hide toggle.
- [x] Helper text + link to https://massive.com/dashboard/signup.

General:
- [x] Mockups in `docs/mockups/issue-183/`; no production code.
- [x] No hardcoded theme colors (all via `:root` vars mirroring Mantine tokens); 2-space indentation.
