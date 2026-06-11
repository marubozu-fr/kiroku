# Issue #113 — Settings delete confirmation modals (mockup)

Static HTML/CSS mockups for the **delete actions + confirmation modals** on the
Kiroku **Settings** page. The Settings page is a Mantine `Tabs` layout (General /
Assets / Tags / Emotions); each managed-entity tab is a striped `Table`. This
issue adds a **row-level delete `ActionIcon`** and a **centered `Modal`** (dimmed
overlay backdrop) with copy that adapts to the entity's `trade_count`.

Two delete behaviors, five modal variants:

- **Tags & Emotions — cascade delete.** Deleting always succeeds; if the entity
  is on trades it is removed from them. Two variants: a **simple** confirm
  (`trade_count == 0`) and a **warning** confirm (`trade_count > 0`) that shows
  an orange callout explaining the cascade.
- **Assets — guarded delete.** Deleting is **refused** while trades reference the
  asset. Two variants: a **simple** confirm (`trade_count == 0`) and a
  **blocking** message (`trade_count > 0`) with **only a Close button — no
  destructive confirm**.

No React, no build. Structure mirrors Mantine 1:1 so the `frontend-dev` agent can
translate directly. Colors/spacing come from `kiroku-mockup.css` CSS variables
that mirror Mantine's dark theme — in the real app these are Mantine tokens
(`var(--mantine-color-*)`), never hardcoded.

Reference: `docs/DESIGN_SYSTEM.md`. Base tokens/components copied verbatim from
`docs/mockups/issue-102/kiroku-mockup.css` (this folder is self-contained — no
cross-folder imports); modal/overlay/tab styles added below the
`ISSUE #113 ADDITIONS` banner in the CSS.

> **Backend status.** The delete + trade-count endpoints already exist: tags
> (cascade) per issue **#110**, emotions (cascade) per issue **#111**, assets
> (guarded) per issue **#112**. This issue produces **mockups only** — the
> frontend wiring (delete `ActionIcon` + `Modal` + the `useDeleteTag` /
> `useDeleteEmotion` / `useDeleteAsset` mutations and trade-count fetch) is a
> **separate follow-up issue**.

## Files

| File | Variant shown |
|------|---------------|
| `settings-tags.html` | Tags tab — **cascade SIMPLE** confirm modal (`trade_count == 0`, tag "Range Fade") |
| `settings-tags-warning.html` | Tags tab — **cascade WARNING** modal (`trade_count > 0` → 38 trades, tag "Breakout") |
| `settings-emotions.html` | Emotions tab — **cascade WARNING** modal (emotion wording, `trade_count > 0` → 12 trades, "FOMO") |
| `settings-assets.html` | Assets tab — **asset SIMPLE** confirm modal (`trade_count == 0`, "NVDA") |
| `settings-assets-blocked.html` | Assets tab — **asset BLOCKING** modal (`trade_count > 0` → 214 trades, "EUR/USD", Close-only) |
| `settings-mobile.html` | Mobile — ~390px phone frame: scrollable Tags table + near-full-width stacked Modal (cascade WARNING) |
| `kiroku-mockup.css` | Shared theme tokens + base components (from issue-102) + issue-113 modal/tab styles |

Open the HTML files directly in a browser. The cascade-simple variant is the
template; the warning/blocking variants add an orange `.callout` between the
question and the "cannot be undone" reminder.

---

## Component mapping (UI element → Mantine component)

### Settings page chrome
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| App shell / navbar | `AppShell` + `AppShell.Navbar` | "Settings" link active |
| Page header | `Stack gap={2}` → `Title order={2}` + `Text c="dimmed"` | title + dimmed subtitle |
| Tabs strip | `Tabs` + `Tabs.List` / `Tabs.Tab` | General / Assets / Tags / Emotions |
| New-entity button | `Button variant="light" size="xs"` | "+ New tag/emotion/asset" |

### Tables (existing — match columns)
| Tab | Columns | Mantine |
|-----|---------|---------|
| Tags | Name (`Badge` cyan) · Description · Active (`Switch`) · **Actions** | `Table` striped + highlightOnHover, `fz="sm"`, `verticalSpacing="xs"` |
| Emotions | Name (`Badge` indigo) · Description · Active (`Switch`) · **Actions** | same |
| Assets | Name (`Text ff="monospace"`) · Category (`Badge`) · Currency (`Text ff="monospace"`) · Active (`Switch`) · **Actions** | same |

Table headers are uppercase, `size="xs"`, `c="dimmed"`. The **Actions** column is
right-aligned and holds the existing edit action plus the new delete action.

### Row actions
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Edit action (existing) | `ActionIcon variant="subtle" color="gray"` + `IconPencil size={20}` | unchanged |
| Delete action (new) | `ActionIcon variant="subtle" color="red"` + `IconTrash size={20}` | placed next to edit in the Actions column; **red = danger** (DESIGN_SYSTEM) |

### Modal — shared shell (all five variants)
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Backdrop | `Modal` overlay (`overlayProps`) | dimmed `rgba(0,0,0,0.65)` |
| Dialog | `Modal centered size="md"` | `radius="md"`, card background |
| Title | `Modal.Title` | "Delete tag" / "Delete emotion" / "Delete asset" / "Cannot delete asset" |
| Close (X) | `Modal` `withCloseButton` → `CloseButton` + `IconX` | top-right |
| Footer | `Group justify="flex-end"` | button row |

### Modal — per-variant body & footer
| Variant | Body | Footer buttons | Backend |
|---------|------|----------------|---------|
| **Cascade SIMPLE** (tags/emotions, `trade_count == 0`) | `Text`: "Delete {name}? This action cannot be undone." | `Button variant="default"` (Cancel) + `Button color="red" variant="filled"` (Delete) | `DELETE /api/tags/{id}` · `/api/emotions/{id}` |
| **Cascade WARNING** (tags/emotions, `trade_count > 0`) | `Text` question + `Alert color="orange"` with `IconAlertTriangle` ("…associated with {N} trade(s). It will be removed from those trades.") + dimmed `Text` "This action cannot be undone." | Cancel + `Button color="red" variant="filled"` (Delete) | same — cascade |
| **Asset SIMPLE** (`trade_count == 0`) | `Text`: "Delete {name}? This action cannot be undone." | Cancel + `Button color="red" variant="filled"` (Delete) | `DELETE /api/assets/{id}` |
| **Asset BLOCKING** (`trade_count > 0`) | `Alert color="orange"` with `IconAlertTriangle` ("Cannot delete {name}. This asset is associated with {N} trade(s).") + dimmed hint | **Only** `Button variant="default"` (Close) — **NO destructive confirm** | guard returns the count; delete refused |

### Callout (warning / blocking)
| Element | Mantine component | Color |
|---------|-------------------|-------|
| Cascade warning | `Alert variant="light" color="orange"` + `IconAlertTriangle size={20}` | **orange** — warning accent |
| Asset blocking | `Alert variant="light" color="orange"` + `IconAlertTriangle size={20}` | **orange** — informational/blocking, not destructive |

---

## Color usage (per DESIGN_SYSTEM.md)

| Use | Token | Where |
|-----|-------|-------|
| **Danger / destructive** | `red.6` (loss token) | delete `ActionIcon` icon hue + destructive confirm `Button color="red"` |
| **Warning accent** | `orange` | cascade callout ("removed from N trades") + asset blocking callout |
| Brand / primary | `blue.6` | active nav, active tab underline, "+ New" light button, table hover row |
| Neutral / secondary | `dimmed` / default | edit `ActionIcon` (`color="gray"`), "cannot be undone" line, table header text |
| Entity badges | cyan (Tags) / indigo (Emotions) | name pills, matching the rest of the app |

**Color decision — danger vs warning.** RED is reserved for the **destructive
action itself** (the delete icon and the filled confirm button) — it means "this
permanently removes data". ORANGE carries every **warning/blocking message**: the
cascade "it will be removed from N trades" callout and the asset "cannot delete"
callout. This keeps a clean read: red = the button you press to destroy; orange =
read-this-first context. Per DESIGN_SYSTEM, warnings are **never** red, and the
P&L green/red semantic is **not used** anywhere on the Settings page.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS emulates Mantine responsive
props at `max-width: 768px`.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger header (`AppShell` collapsed) |
| Tabs strip | inline row | horizontally scrollable if it overflows |
| Tables | full width | wrapped in `Table.ScrollContainer` → **horizontal scroll** (`min-width` preserved) |
| Modal | `size="md"` (~440px), centered | near full-width with side padding; centered vertically |
| Footer buttons | right-aligned `Group` | stays right-aligned; wraps if needed |

### Responsive decisions
- The delete/edit **Actions** column stays in the table (not collapsed into a
  menu) — with only two icons it fits, and the table already scrolls horizontally
  on phones (DESIGN_SYSTEM: "Tables become scrollable horizontally on small
  screens"). `settings-mobile.html` shows the table with a `min-width` so the
  Actions column is reachable by scroll.
- The **Modal** is the standard Mantine `Modal`, which on small screens fills
  most of the width with comfortable side gutters; the dimmed overlay still
  covers the viewport. `settings-mobile.html` scopes the overlay to the phone
  frame for the static mockup only — in the app the overlay covers the viewport.

### Empty-state note
The delete modals presuppose at least one row exists. The empty Settings tables
(no tags / emotions / assets yet) reuse the shared `.empty-state` pattern
(icon + "No tags yet" + "+ New tag" CTA) already defined in the base CSS and used
across the app; that empty state is **out of scope for this issue** (it belongs to
the table mockups, not the delete-modal issue) and is therefore not duplicated
here.

---

## i18n note (proposed keys + EN copy)

Every user-facing string maps to a `t('settings.<entity>.delete.*')` key. EN is
the source of truth (`en.json`); all six locales mirror the structure. Entity
names and trade counts are interpolated with `{{name}}` / `{{count}}` and use
`react-i18next` plurals for "trade(s)".

### Shared / common
| Key | EN copy |
|-----|---------|
| `common.actions.cancel` | `Cancel` |
| `common.actions.close` | `Close` |
| `common.actions.delete` | `Delete` |
| `common.actions.edit` | `Edit` |
| `settings.tabs.general` | `General` |
| `settings.tabs.assets` | `Assets` |
| `settings.tabs.tags` | `Tags` |
| `settings.tabs.emotions` | `Emotions` |

### Tags — cascade (`settings.tags.delete.*`)
| Variant | Key | EN copy |
|---------|-----|---------|
| Title | `settings.tags.delete.title` | `Delete tag` |
| SIMPLE (`trade_count == 0`) | `settings.tags.delete.simple` | `Delete {{name}}? This action cannot be undone.` |
| WARNING (`trade_count > 0`) | `settings.tags.delete.warning` | `This tag is associated with {{count}} trade. It will be removed from those trades.` / *plural*: `…associated with {{count}} trades. It will be removed from those trades.` |
| WARNING question | `settings.tags.delete.question` | `Delete {{name}}?` |
| Undone reminder | `settings.tags.delete.undone` | `This action cannot be undone.` |

### Emotions — cascade (`settings.emotions.delete.*`)
| Variant | Key | EN copy |
|---------|-----|---------|
| Title | `settings.emotions.delete.title` | `Delete emotion` |
| SIMPLE | `settings.emotions.delete.simple` | `Delete {{name}}? This action cannot be undone.` |
| WARNING | `settings.emotions.delete.warning` | `This emotion is associated with {{count}} trade. It will be removed from those trades.` / *plural*: `…associated with {{count}} trades. It will be removed from those trades.` |
| WARNING question | `settings.emotions.delete.question` | `Delete {{name}}?` |
| Undone reminder | `settings.emotions.delete.undone` | `This action cannot be undone.` |

### Assets — guarded (`settings.assets.delete.*`)
| Variant | Key | EN copy |
|---------|-----|---------|
| Title (deletable) | `settings.assets.delete.title` | `Delete asset` |
| SIMPLE (`trade_count == 0`) | `settings.assets.delete.simple` | `Delete {{name}}? This action cannot be undone.` |
| Title (blocked) | `settings.assets.delete.blockedTitle` | `Cannot delete asset` |
| BLOCKING (`trade_count > 0`) | `settings.assets.delete.blocked` | `Cannot delete {{name}}. This asset is associated with {{count}} trade.` / *plural*: `Cannot delete {{name}}. This asset is associated with {{count}} trades.` |
| Blocking hint | `settings.assets.delete.blockedHint` | `Reassign or delete those trades first, then try again.` |

> Trading terms (asset symbols like `EUR/USD`, `BTC/USDT`, `ES`, `NVDA`) stay in
> English in all languages per `docs/I18N_GLOSSARY.md`. "trade(s)" uses i18next
> plural keys (`_one` / `_other`).

---

## Sample data (internally consistent)

One trader's catalog.

| Tab | Rows | Delete target | trade_count | Variant |
|-----|------|---------------|-------------|---------|
| Tags | Breakout, Pullback, News Spike, Range Fade | **Range Fade** | 0 | cascade SIMPLE |
| Tags | (same) | **Breakout** | 38 | cascade WARNING |
| Emotions | Confident, FOMO, Revenge, Hesitant | **FOMO** | 12 | cascade WARNING |
| Assets | EUR/USD, BTC/USDT, ES, NVDA | **NVDA** | 0 | asset SIMPLE |
| Assets | (same) | **EUR/USD** | 214 | asset BLOCKING |

Counts are realistic (a newly added "Range Fade" tag and a freshly created "NVDA"
asset have no trades yet; the long-used "EUR/USD" pair carries 214). No mock
statistics are displayed — these stand in for the real `trade_count` returned by
the #110/#111/#112 endpoints.

---

## Acceptance-criteria & deliverables checklist

### Issue requirements
- [x] Delete `ActionIcon` on every Tags / Emotions / Assets row (next to edit).
- [x] Cascade **SIMPLE** modal (`trade_count == 0`) — `settings-tags.html`.
- [x] Cascade **WARNING** modal (`trade_count > 0`, "removed from those trades") — `settings-tags-warning.html` (tag) + `settings-emotions.html` (emotion wording).
- [x] Asset **SIMPLE** modal (`trade_count == 0`) — `settings-assets.html`.
- [x] Asset **BLOCKING** modal (`trade_count > 0`, Close-only, no confirm) — `settings-assets-blocked.html`.
- [x] Responsive / mobile demonstration — `settings-mobile.html`.

### Design-system compliance
- [x] Centered `Modal` over a dimmed overlay backdrop.
- [x] Destructive confirm = `Button color="red" variant="filled"`; Cancel/Close = `Button variant="default"`.
- [x] Warnings/blocking in **orange** (`IconAlertTriangle`), never red.
- [x] Delete `ActionIcon` = `variant="subtle" color="red"` + `IconTrash size={20}`, beside the gray `IconPencil` edit.
- [x] Tables striped + highlightOnHover, `fz="sm"`, uppercase dimmed `xs` headers.
- [x] No hardcoded theme colors (all via `:root` vars mirroring Mantine tokens); 2-space indentation.
- [x] i18n keys proposed for all five variants with EN copy + plural note.
