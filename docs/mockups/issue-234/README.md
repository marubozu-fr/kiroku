# Issue #234 — Chart timeframes configuration UI

Static HTML/CSS mockups for making chart timeframes **user-configurable** at two
levels: **global defaults** in Settings → General, and **per-trade overrides** in
the trade form. Today the timeframes are hardcoded server-side as
`("M1", "M5", "M15", "H1", "H4", "D1")`.

**Design-only** issue — no React, no build, **no production code**. Structure
mirrors Mantine 1:1 so the `frontend-dev` agent can translate directly.
Colors/spacing come from `kiroku-mockup.css` CSS variables that mirror Mantine's
theme tokens — in the real app these are Mantine tokens
(`var(--mantine-color-*)`), never hardcoded. The base stylesheet is carried over
verbatim from `docs/mockups/issue-205-C/`; **issue #234 appends the chart-timeframe
styles** under the `Issue #234` banner (the folder is self-contained — no
cross-folder imports).

Reference: `docs/DESIGN_SYSTEM.md`. Open the HTML files directly in a browser.

## Files

| File | Shows |
|------|-------|
| `settings-chart-timeframes.html` | The new **Chart Timeframes** card on Settings → General, in five previews: **A** Desktop · Dark · populated (full tab context: Chart Data → Chart Timeframes → Backup); **B** Desktop · Light · populated (theme parity); **C** Desktop · Dark · soft-limit (9 timeframes → orange warning, **not** blocked); **D** Desktop · Dark · empty (no defaults → helpful empty state); **E** Mobile · Light · populated (responsive, phone frame). |
| `trade-form-chart-timeframes.html` | The **Chart Timeframes** selector in the trade form, in five previews: **A** Desktop · Dark · default (entry tf `1h` not in defaults → separate **locked** chip); **B** Desktop · Dark · dedup (entry tf `15m` is in defaults → single locked chip); **C** Desktop · Dark · soft-limit (9 chips → orange warning); **D** Desktop · Light · default (theme parity); **E** Mobile · Light · default (responsive, phone frame). |
| `kiroku-mockup.css` | Shared theme tokens + base components (from issue-205-C) **+ issue-234 additions** (timeframe input row, chip list, locked entry-tf chip, soft-limit counter). |

The panels are stacked in one page using mockup-only preview chrome
(`.preview-grid`, `.preview-col`, `.preview-label`) so reviewers see every state
side by side. That chrome is layout scaffolding, **not** app UI.

---

## Behavior summary

### Settings → General · "Chart Timeframes" card

Placed between the **Chart Data** card (#205-C) and the **Backup** card. Two
fields:

1. **Default entry timeframe** — a `(value, unit)` pair using the same value +
   unit-`Select` pattern as the existing *Entry timeframe* field. Pre-fills the
   trade form's *Entry timeframe* when creating a new trade. May be empty.
2. **Default chart timeframes** — an editable list of `(value, unit)` chips. An
   add row (value + unit + **Add**) appends; each chip has a × to remove. The
   list is **sorted by weight**: `D > W > H > M`, then **value descending** (e.g.
   `1d, 4h, 1h, 15m`). Above **8** timeframes a **non-blocking** orange warning
   appears: *"Chart loading may be slower with more than 8 timeframes"* (the user
   is informed, never blocked).

### Trade form · "Chart Timeframes" selector

Placed **directly after** the existing *Entry timeframe* field. Prefilled with
the user's default chart timeframes from Settings. The user can remove chips and
add trade-specific ones.

- The trade's **entry timeframe is always implicitly included** — shown as a
  **locked chip** (no × ) with an "entry · always" note, because it is injected
  **server-side**. It is informational here, not a removable selection.
- **Dedup**: if the entry timeframe also appears in the default list, it renders
  **once** (as the locked chip) — never duplicated.
- Same sort-by-weight ordering and same 8-timeframe soft warning as Settings.

---

## Sort order (canonical)

Unit weight `D(4) > W(3) > H(2) > M(1)`, then numeric value **descending** within
the same... note the requirement spells it `D > W > H > M`. Reference ordering
used in the mockups:

```
1w, 1d, 12h, 4h, 1h, 30m, 15m, 5m, 1m
```

> Implementation note: the issue text lists the unit precedence literally as
> "D > W > H > M". The mockups follow that order (a day-chip sorts above a
> week-chip). If real-world weight should instead be strictly chronological
> (`W > D > H > M`), confirm with the issue author before implementing — the
> sort comparator is the only place this matters and it is a one-line change.

---

## Component mapping (UI element → Mantine component)

### Settings — target `frontend/src/components/settings/GeneralTab.tsx`

Add one `Card` after the Chart Data card. (A dedicated `ChartTimeframesCard`
component is reasonable to keep `GeneralTab` lean.)

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Card container (`.card`) | `Card withBorder padding="md" radius="md"` | Sits between Chart Data and Backup |
| Section title (`.section-title`) | `Title order={4}` | `t('settings.chart_timeframes.title')` → "Chart Timeframes" |
| Field label (`.field > label`) | `Input.Label` / field `label` prop | "Default entry timeframe" / "Default chart timeframes" |
| Field help (`.field-desc`) | `Input.Wrapper` `description` or `Text c="dimmed" fz="xs"` | One line under each label |
| Value input (`.tf-value > input`) | `NumberInput` `min={0}` `allowDecimal={false}` | Same constraints as the existing timeframe value input |
| Unit select (`.tf-unit > select`) | `Select` `data={['m','h','d','w']}` | Reuse `TIMEFRAME_UNITS` + `t('trade.form.timeframe_units.*')` labels |
| Value + unit row (`.tf-input-row`) | `Group gap="sm"` or `Grid` | Mirrors the trade form's entry-timeframe `Grid` row |
| Add button (`.btn.light.sm`) | `Button variant="light" size="xs"` | Appends `(value, unit)` to the list; clears the inputs |
| Chip list (`.tf-chips`) | `Group gap="xs"` | Sorted before render (weight, then value desc) |
| Chip (`.tf-chip`) | `Badge` with right `×` or custom `Pill` | Monospace label (`1d`, `4h`, …); `×` = remove |
| Chip remove (`.tf-remove`) | `Badge` `rightSection` `CloseButton` / `Pill` `withRemoveButton` | `aria-label="Remove {tf}"` |
| Empty state (`.tf-chips-empty`) | `Text c="dimmed" fz="sm" fs="italic"` | When no defaults configured |
| Soft-limit warning (`.callout.warning`) | `Alert variant="light" color="orange" icon={<IconAlertTriangle/>}` | Rendered only when `count > 8`; non-blocking |
| Count line (`.tf-count`) | `Text c="dimmed" fz="xs"` | Live "{n} timeframes" |
| Save button | `Button variant="light" size="xs"` | Persists via `preferencesApi.update(...)` |

### Trade form — target `frontend/src/pages/TradeFormPage.tsx`

Add the **Chart Timeframes** field inside the Configuration card, immediately
after the existing *Entry timeframe* `Input.Wrapper` (~line 775–799). Reuse the
same chip/add primitives as Settings (extract a shared `TimeframeChips`
component).

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Selector wrapper | `Input.Wrapper label={t('trade.form.fields.chart_timeframes_label')}` | "Chart Timeframes" |
| Add row + chips | same as Settings | Prefilled from `preferences.chart_timeframes_default` |
| Locked entry chip (`.tf-chip.locked`) | `Badge color="blue" variant="light"` (no remove) | The entry timeframe; injected server-side. Tooltip/note: "entry · always" |
| Dedup | — | If entry tf ∈ defaults, render once as the locked chip |
| Soft-limit warning | `Alert variant="light" color="orange"` | Count includes the implicit entry tf |

---

## Color & semantic compliance

- **Orange = warning** for the soft limit — **never red** (red is reserved for
  financial loss per the design system). The warning is informational and does
  **not** block saving or submitting.
- The locked entry chip uses the **blue/primary** accent (informational), the
  same hue used elsewhere for neutral info — not green/red.
- Financial-style tokens (`1d`, `4h`) are rendered in the **monospace** family,
  consistent with how the app renders timeframes elsewhere.

---

## Responsive notes

- The value + unit + Add row uses flex; on narrow widths the inputs stay on one
  line (the unit select is fixed-width, the value flexes). In Mantine, a
  `Group wrap="wrap"` or a `Grid` achieves the same.
- Chips wrap naturally (`flex-wrap`) — no horizontal scroll.
- The Settings card and the trade form field both fit the existing single-column
  mobile layout (phone-frame previews **E**).

---

## i18n keys to add (EN source of truth — mirror across all 6 locales)

> Final keys are the implementer's call; this is the suggested shape. Unit labels
> already exist under `trade.form.timeframe_units.*`.

```jsonc
// settings.*
"settings.chart_timeframes.title": "Chart Timeframes",
"settings.chart_timeframes.entry_default_label": "Default entry timeframe",
"settings.chart_timeframes.entry_default_description": "Pre-fills the entry timeframe when you create a new trade.",
"settings.chart_timeframes.list_label": "Default chart timeframes",
"settings.chart_timeframes.list_description": "Shown by default on every trade chart. Add or remove as you like.",
"settings.chart_timeframes.add": "Add",
"settings.chart_timeframes.empty": "No default timeframes yet — add one above to get started.",
"settings.chart_timeframes.count": "{{count}} timeframes",
"settings.chart_timeframes.soft_limit_warning": "Chart loading may be slower with more than 8 timeframes",
"settings.chart_timeframes.remove_aria": "Remove {{timeframe}}",

// trade.form.*
"trade.form.fields.chart_timeframes_label": "Chart Timeframes",
"trade.form.fields.chart_timeframes_description": "Timeframes shown on this trade's chart. Prefilled from your Settings defaults.",
"trade.form.fields.chart_timeframes_entry_note": "entry · always"
```

The trading unit tokens (`m`, `h`, `d`, `w`) and timeframe shorthand (`1d`, `4h`)
stay in English in all languages per `docs/I18N_GLOSSARY.md`.
