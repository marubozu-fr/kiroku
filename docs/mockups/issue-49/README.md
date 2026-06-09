# Issue #49 — Trade form & view redesign (mockup)

Static HTML/CSS mockups for the redesigned trade creation/edit form and trade
detail view. No React, no build. Structure mirrors Mantine components 1:1 so the
`frontend-dev` agent can translate directly. Colors/spacing come from
`kiroku-mockup.css` CSS variables that mirror Mantine's dark theme — in the real
app these are Mantine tokens (`var(--mantine-color-*)`), never hardcoded.

Reference: `docs/DESIGN_SYSTEM.md`, `docs/designs/APP_DESIGN.md` §3.3 / §3.4.

## Files

| File | Purpose |
|------|---------|
| `trade-form-empty.html` | Creation form, empty state (no direction, exits locked, no screenshots) |
| `trade-form-populated.html` | Creation form, populated (2 entries + 2 exits with live totals, 2 staged screenshots) |
| `trade-detail-view.html` | Detail view with new grouping + `account_type` badge |
| `kiroku-mockup.css` | Shared theme tokens + component styles |

Open the HTML files directly in a browser. Resize below ~768px (Mantine `sm`) to
see the responsive stacking.

---

## Component mapping (UI element → Mantine component)

### Layout
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| App shell / navbar | `AppShell` + `AppShell.Navbar` | Canonical, already exists — not redesigned |
| Page header row | `Group justify="space-between"` + `Title order={2}` | Title left, Cancel/Save right |
| Two-column layout | `Grid` / `SimpleGrid cols={{ base: 1, sm: 2 }}` | Left ~360px config, right fluid activities |
| Section cards | `Card padding="md" radius="md"` | One per section |
| Section divider inside card | `Divider` (optionally with `label`) | |

### Configuration column (left)
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Asset | `Select` | Grouped by category, `searchable`, `withAsterisk`, active assets only |
| **Account type** | `SegmentedControl` | Data `Test \| Demo \| Live`; value default `Live`; API enum `test/demo/live` |
| Entry timeframe | `Select` (unit) + `NumberInput` (value) | M/H/D/W → e.g. "H1" |
| Tags | `MultiSelect` | searchable; selected shown as removable pills |
| Emotions | `MultiSelect` | grouped by category, severity dot/badge in option |

### Activities column (right)
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| **Direction** | `SegmentedControl` | `Long \| Short`, **required**, above entries/exits. Active hue teal/grape (non-semantic) |
| Stop loss | `NumberInput` | monospace, decimals — grouped with activities (R calc) |
| Risk per trade % | `NumberInput` | monospace, percent |
| **Entries sub-section** | `Stack` in left `Grid.Col` (`entries-column`) | one row per entry |
| **Exits sub-section** | `Stack` in right `Grid.Col` (`exits-column`) | disabled until ≥1 entry |
| Entry/exit row | `Group`: `DateInput` · `NumberInput` qty · `NumberInput` price · `ActionIcon` (`IconTrash`) | type auto-set from direction |
| Add entry / Add exit | `Button variant="light"` `leftSection={<IconPlus/>}` | `form.insertListItem` |
| Live total qty / avg price | `Text ff="monospace"` | computed in component from row values |
| Notes | `Textarea` autosize, ≤2000 | kept as-is |
| Missed opportunity | `Checkbox` | kept as-is |

### Screenshots
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Drag & drop / click area | `Dropzone` (`@mantine/dropzone`) | accepts images |
| Preview grid | `SimpleGrid` of `Image` (or `Card`) | `src={URL.createObjectURL(file)}` |
| Remove from staging | `ActionIcon` overlay (`IconX`) | removes `File` from state |
| Existing screenshot (edit) | same preview + "existing" badge + delete `ActionIcon` | `DELETE` existing; add new staged |

### Detail view
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Direction badge | `Badge color="teal"` (Long) / `"grape"` (Short) | **non-semantic** — never green/red |
| Status badge | `Badge` blue/gray/yellow | Open/Closed/Partial |
| **Account type badge** | `Badge` | Live/Demo/Test |
| Metric cards (P&L, R, R:R, Duration) | `SimpleGrid cols={{ base: 2, sm: 4 }}` of `Card` | value `size="xl" fw={700} ff="monospace"` |
| Config key/value | `Group`/`SimpleGrid` or simple definition list | dimmed label + value |
| Activities timeline | `Timeline` | entry bullet highlighted (`IconLogin`), exit different icon |
| Screenshots gallery | `SimpleGrid` grouped by timeframe → click `Modal` lightbox | display only |

### Financial numbers
All prices, quantities, P&L, and R values use the shared `<Money>` / `<RValue>`
helper: `ff="monospace"`, right-aligned in tables, **signed + semantic color for
P&L/R** (green profit / red loss / dimmed neutral). Raw entry/exit prices are
monospace but **not** semantically colored.

---

## Color usage (per DESIGN_SYSTEM.md)

| Use | Token | Where |
|-----|-------|-------|
| Profit / positive R | `green.6` | P&L `+56.70`, R `+2.4R` |
| Loss / negative R | `red.6` | negative P&L/R (none in sample) |
| Neutral / no data | `dimmed` | empty totals (`—`), open duration |
| Form errors / asterisk / Warning emotion | `orange` | required `*`, field errors, FOMO badge |
| Long direction | `teal` | Direction badge + segmented active |
| Short direction | `grape` | Direction badge + segmented active |
| Good / Bad emotion severity | `green` / `red` | documented carve-out (APP_DESIGN §2.5) |

Green/red are reserved for P&L/R only. Direction deliberately uses teal/grape so
it never collides with profit/loss meaning.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS stacks at `max-width: 768px`.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger drawer (`AppShell` collapsed) |
| Page two-column | left config (~360px) + right activities side by side | **single column**: Configuration card stacks **above** Activities |
| Entries / Exits columns | side by side (`entries-column` \| `exits-column`) | **stack vertically**: Entries above Exits (still showing per-section live totals) |
| Entry/exit row inputs | inline `Group` (date/qty/price/trash) | inputs wrap/stack; remove button stays reachable |
| Stop loss + Risk (`row-2`) | 2-up | 1-up |
| Timeframe unit + value | 2-up | 1-up |
| Metric cards (detail) | `cols={4}` | `cols={2}` |
| Screenshot previews | `auto-fill minmax(150px)` grid | fewer per row, still grid |
| Page header right cluster | inline | wraps below title (`Group` wraps) |

Implementation: use Mantine responsive props (`cols={{ base: 1, sm: 2 }}`,
`Grid.Col span={{ base: 12, sm: 6 }}`) rather than raw media queries. The CSS media
query here only emulates that for the static mockup.

---

## Acceptance-criteria & change checklist

### The 5 changes
- [x] **1. Direction (Long/Short)** — required `SegmentedControl` in Activities section,
      above entries/exits. Sets entry=Buy/exit=Sell (Long) automatically. Shown in all 3
      files; populated file demonstrates Long selected + auto type tags.
- [x] **2. Account type** — `Test | Demo | Live` `SegmentedControl`, default **Live**, in
      left Configuration column (both form files). Shown as a badge on the detail view.
- [x] **3. Entries/Exits separation** — `entries-column` / `exits-column` side by side,
      each with date/qty/price rows + live **total quantity** and **average price**. Exits
      **disabled until ≥1 entry** (empty file). Exit qty ≤ entry qty note (populated file:
      15000 = 15000, remaining 0).
- [x] **4. Field grouping** — Activities (right): direction, stop loss, risk per trade,
      entries/exits. Configuration (left): asset, account type, entry timeframe, tags,
      emotions. Notes + "Missed opportunity" kept. Stop loss/risk moved out of timeframe group.
- [x] **5. Screenshot upload** — `Dropzone` + preview grid via `URL.createObjectURL()`,
      `File` objects in state, uploaded after creation (`POST /api/trades/{id}/screenshots`).
      Empty file: dropzone only. Populated file: 2 staged previews with remove. Edit shows
      existing + delete + add (documented; same preview pattern + "existing" badge).

### Issue acceptance criteria
- [x] Mockup covers all 5 changes (above).
- [x] Follows `docs/DESIGN_SYSTEM.md` — Mantine dark theme tokens, semantic colors
      (green=profit, red=loss, orange=errors), monospace for all financial numbers,
      direction teal/grape (non-semantic).
- [x] Both empty and populated states shown (`trade-form-empty.html`,
      `trade-form-populated.html`).
- [x] Responsive layout specified (section above + emulated in CSS at `sm`).

### Deliverables
- [x] Trade creation form — empty state.
- [x] Trade creation form — populated state (entries + exits + screenshots).
- [x] Trade detail view page.
- [x] Component list (mapping table above).
- [x] Responsive behavior notes (mobile breakpoint).
