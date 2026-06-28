# Issue #246 — Mockups: Settings & Manage restructure (M7)

Static HTML/CSS mockups for the **M7 — Settings & Manage** milestone. They are
design artifacts only: no React, no tests. Open any `.html` directly in a
browser; all share `kiroku-mockup.css`.

The stylesheet is carried forward verbatim from `docs/mockups/issue-234`
(self-contained, no cross-folder imports) and extended at the bottom under the
`ISSUE #246 ADDITIONS` banner. CSS variables mirror Mantine's dark/light theme
tokens — in the real app these come from `var(--mantine-color-*)`, never
hardcoded. The `.theme-light` scope and the `.preview-*` chrome are
mockup-only previewing scaffolding, not app UI.

All visuals comply with `docs/DESIGN_SYSTEM.md`: Mantine dark theme as the base,
green/red reserved for financial P&L only, orange for warnings, red for
destructive actions, monospace for numbers/timeframes.

## Files

| File | Covers |
|------|--------|
| `nav-sidebar.html` | New two-section navigation (Manage in main group, Settings pinned bottom) |
| `manage-assets.html` | Manage page · Assets tab with column-level filters |
| `manage-tags.html` | Manage page · Tags tab filters (+ Emotions tab filter combination) |
| `settings-platform.html` | Settings page · Platform tab (Appearance + Backup/Restore) |
| `settings-charts.html` | Settings page · Charts tab (Data Provider + Timeframes) |
| `trade-form-timeframes.html` | Trade form · harmonized timeframe pickers |
| `kiroku-mockup.css` | Shared stylesheet |

Each HTML uses the `.preview-grid` chrome to show several states (dark/light/
mobile/populated/empty/filtered) side by side. A leading HTML comment in each
file lists the panels.

---

## 1. Navigation — `nav-sidebar.html`

The sidebar splits into two `AppShell.Section` blocks inside `AppShell.Navbar`:

```tsx
<AppShell.Navbar p="sm">
  <AppShell.Section><Logo /></AppShell.Section>
  <AppShell.Section grow>
    {mainNavItems.map(renderNavLink)}   {/* Dashboard, Journal, Analytics, Projections, Manage */}
  </AppShell.Section>
  <AppShell.Section>
    {renderNavLink(settingsNavItem)}     {/* Settings — pinned to the bottom */}
  </AppShell.Section>
</AppShell.Navbar>
```

- The middle section's `grow` prop pushes the Settings section to the bottom.
  A top border on the bottom section provides the visual separation.
- `navItems.ts` splits into `mainNavItems` (Dashboard, Journal, Analytics,
  Projections, **Manage**) and a separate `settingsNavItem`.
- **Manage** icon: `IconCategory2` (four squares + circle) — deliberately
  distinct from Settings' `IconSettings` gear, and not `IconAdjustments`.
  Route: `/manage`. New i18n key: `nav.manage`.
- Mockup classes → app: `.navbar .nav-main` = `AppShell.Section grow`,
  `.navbar .nav-bottom` = the bottom `AppShell.Section`, `.navlink` = `NavLink`.

| Mockup class | Mantine |
|---|---|
| `.navlink` / `.navlink.active` | `NavLink` (`active` prop) |
| `.nav-main` | `AppShell.Section grow` |
| `.nav-bottom` | `AppShell.Section` (bottom) |

---

## 2. Manage page — `manage-assets.html`, `manage-tags.html`

New page at `/manage`: `Title order={2}` "Manage", subtitle
*"Manage your assets, tags and emotions."*, then a 3-tab `Tabs`
(Assets / Tags / Emotions). Each tab renders the **same** table component that
currently lives on the matching Settings tab (`AssetsTab`, `TagsTab`,
`EmotionsTab`) — moved, not rewritten — plus a column filter row.

### Column filter row

A second `Table.Tr` inside `Table.Thead`, below the header labels, always
visible (no toggle). One compact control per filterable column:

| Table | Column | Control | Placeholder | Options |
|---|---|---|---|---|
| Assets | Name | `TextInput size="xs"` | `Filter...` | — |
| Assets | Category | `Select size="xs"` | `All` | `ASSET_CATEGORIES` |
| Assets | Currency | `Select size="xs"` | `All` | currencies in use |
| Assets | Active | `Select size="xs"` | `All` | Yes / No |
| Tags | Name | `TextInput size="xs"` | `Filter...` | — |
| Tags | Description | `TextInput size="xs"` | `Filter...` | — |
| Emotions | Name | `TextInput size="xs"` | `Filter...` | — |
| Emotions | Category | `Select size="xs"` | `All` | `EMOTION_CATEGORIES` |

- Filtering is **client-side** over the list already loaded by `useFetch`
  (no new API params). Name/Description match case-insensitive substring;
  Selects match exact value; "All" / empty = no constraint.
- Filter state is local component state; combine all active filters with AND.
- The Actions column has no filter — render an empty `Table.Th`.
- Emotions keeps its existing category grouping (`Title order={5}` per group);
  the filter row sits in each rendered group's `Thead`. Category filter, when
  set, simply narrows which groups render.
- Empty result → reuse the existing `DataStates` empty branch with a "No
  matching …" message (see `manage-assets.html` panel D). This is distinct from
  the "no records at all" empty state.

| Mockup class | Mantine |
|---|---|
| `tr.filter-row` | second `Table.Tr` in `Table.Thead` |
| `.input-xs` (text) | `TextInput size="xs"` |
| `select.input-xs` | `Select size="xs"` |
| `.badge.closed/.tag/.emotion` | `Badge variant="light"` |
| `.switch` / `.switch.on` | `Switch` (active toggle, unchanged) |
| `.icon-btn` | `ActionIcon variant="subtle"` (edit/delete) |

> The mockups render emoji glyphs (✎ 🗑 👁) and inline SVGs as stand-ins; the
> app uses `@tabler/icons-react` (`IconPencil`, `IconTrash`, `IconEye`,
> `IconPlus`, `IconCategory2`) at size 20.

---

## 3. Settings refactor — `settings-platform.html`, `settings-charts.html`

The old 5-tab Settings (General / Assets / Tags / Emotions / News) collapses to
**two** tabs. Assets/Tags/Emotions move to `/manage`. Subtitle:
*"Configure your platform and chart preferences."*

### Tab: Platform (`settings-platform.html`)

Two peer `Card`s in a `Stack maw={520}`:

- **Appearance** — Language `Select` (existing) + Theme `Select` (dark/light).
  The Theme Select is a *second* access point; the header `ActionIcon` toggle
  stays as-is. Both write the same color-scheme preference.
- **Backup** — backup directory `TextInput` + "Save path" `Button variant="default"`
  (inline, baseline-aligned via `.btn-align`), the backup-reminder `Select`,
  "Back up now" `Button`, and the last-backup `Text c="dimmed"`. The **Restore**
  flow is a subsection within the same Card (a divider then a `Dropzone` for the
  `.zip`), keeping all backup/restore controls together. The restore confirm
  `Modal` and version-mismatch `Alert` are unchanged from issue #172/#178.

### Tab: Charts (`settings-charts.html`)

Two peer `Card`s:

- **Data Provider** — Massive API key `PasswordInput` (built-in eye toggle) with
  a description containing the "Get a free API key" `Anchor`
  (`https://massive.com/dashboard/signup`) + a Save `Button`. (If the provider
  Select from issue #205-C is in play, it lives here too; the mockup shows the
  API-key field directly for clarity.)
- **Timeframes** — the issue #234 controls: *Default entry timeframe*
  ([value] [unit]) and *Default chart timeframes* ([value] [unit] [Add] + chip
  list) + Save. Soft-limit (>8) orange warning and sort-by-weight unchanged.

| Mockup class | Mantine |
|---|---|
| `.tabs` / `.tab.active` | `Tabs` / `Tabs.Tab` |
| `.card` + `.section-title` | `Card withBorder padding="md"` + `Title order={4}` |
| `.field` + `label` + `.field-desc` | input wrapper: `label` → `description` → input |
| `.field-row` + `.btn-align` | `Group align="flex-end"` (input + Save path) |
| `.input-with-toggle` + `.reveal-btn` | `PasswordInput` |
| `.field-desc a` | `Anchor` |
| `.dropzone` | `@mantine/dropzone` `Dropzone` (accept `application/zip`) |
| `.tf-input-row` / `.tf-chips` / `.tf-chip` | issue #234 timeframe primitives |

---

## 4. Timeframe harmonization — `trade-form-timeframes.html`

Two rules applied wherever a timeframe is entered — **Settings → Charts** (entry
TF and chart TFs) **and** the trade add/edit form (entry TF and chart TFs):

1. **Field order is always `[value NumberInput] [unit Select]`.** The trade
   form's Entry timeframe was reversed (`[unit] [value]`); it is reordered to
   match the chart-TF add row and the Settings defaults. Panel A shows the
   before/after side by side.
2. **Every unit `Select` uses `placeholder="Pick a unit"` with no default
   value** (`value={null}` / no pre-selected option). Previously some defaulted
   to "Minutes". In the mockup this is
   `<option value="" disabled hidden>Pick a unit</option>` with no `selected`
   data option.

Unchanged from issue #234: the entry timeframe always appears as a non-removable
`.tf-chip.locked` chip (injected server-side), deduped if it also appears in the
defaults; chips sort by weight (D > W > H > M, then value descending); the
>8-timeframe soft warning is a non-blocking orange `Alert`.

In code, the unit values are the single letters `m/h/d/w` (the chip label is
`{value}{unit}`, e.g. `15m`, `4h`). The `Select` may show full words ("Minutes")
as labels while storing the letter — match whatever the existing
`ChartTimeframesCard` / trade form already does; the only behavioural change is
the placeholder and the absence of a default.

---

## Responsive notes

- Sidebar collapses to a hamburger `Drawer` below the `sm` breakpoint (`.navbar`
  is hidden in the mockup at ≤768px); the two-section structure is preserved
  inside the drawer.
- Manage tables use `Table.ScrollContainer minWidth={…}` and scroll
  horizontally on narrow screens; the filter row scrolls with the header.
- The 2-up `preview-grid` and the phone-frame panels collapse to a single
  column at ≤900px. Settings cards (`maw={520}`) and the trade form go
  full-width on mobile.
- `.tf-input-row` keeps `[value] [unit] [Add]` on one line; the `.tf-unit`
  Select is fixed-width (96px) so the value input flexes.

## Out of scope for these mockups

- The News tab: the issue does not list it in the new 2-tab Settings. Its
  placement (drop, or fold into a future tab) is a follow-up decision — flagged
  here, not silently resolved in the mockups.
