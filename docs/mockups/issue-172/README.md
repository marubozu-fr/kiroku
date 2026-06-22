# Issue #172 — Backup & Restore UI (mockup)

Static HTML/CSS mockups for the **backup & restore** feature. Two UI surfaces:

1. A **Backup & Restore section** added to **Settings → General** (below the
   existing language selector, inside `GeneralTab`).
2. A **reminder banner** rendered in the `AppShell` layout (all pages), above the
   page content.

No React, no build. Structure mirrors Mantine 1:1 so the `frontend-dev` agent can
translate directly. Colors/spacing come from `kiroku-mockup.css` CSS variables
that mirror Mantine's dark theme — in the real app these are Mantine tokens
(`var(--mantine-color-*)`), never hardcoded. Base tokens/components are copied
verbatim from `docs/mockups/issue-113/kiroku-mockup.css` (this folder is
self-contained — no cross-folder imports); backup/restore styles are added below
the `ISSUE #172 ADDITIONS` banner in the CSS.

Reference: `docs/DESIGN_SYSTEM.md` and `docs/designs/APP_DESIGN.md`.

> **CSS class → Mantine note.** Both `.callout.warning` (restore version Alert)
> and `.banner` (reminder banner) are the stand-in for Mantine `Alert`
> (`color="orange" variant="light"` + `IconAlertTriangle`) — the differing class
> names are only mockup naming; they map to the same component.

## Files

| File | Variant shown |
|------|---------------|
| `settings-general-backup.html` | General tab — language selector + Backup card (path configured, "Last backup" shown, **Back up now** enabled) + Restore card |
| `settings-general-backup-no-path.html` | General tab — **no valid path**: inline 422 path error + **Back up now** disabled (dimmed + tooltip), "Last backup: Never" |
| `settings-general-restore.html` | General tab — **Restore Modal open, no version warning** (backup version == installed) |
| `settings-general-restore-warning.html` | General tab — **Restore Modal open, version-mismatch Alert** (backup v0.7.0 > installed v0.6.4) |
| `banner-never.html` | Dashboard — reminder banner, **"haven't backed up yet"** message |
| `banner-overdue.html` | Journal — reminder banner, **"12 days ago"** message |
| `banner-mobile.html` | ~390px phone frame — reminder banner in **stacked** layout |
| `kiroku-mockup.css` | Shared theme tokens + base components (from issue-113) + issue-172 backup/restore styles |

Open the HTML files directly in a browser.

> **Note on `settings-general-backup-no-path.html`.** The issue lists both an
> *empty/invalid path → disabled Back up now* state and an *inline 422 path error*
> element. This file shows both at once (a path that failed `PATCH /api/preferences`
> validation, so no usable directory is configured): the input carries
> `.input.error` + a `.field-error` line, and **Back up now** stays disabled
> because no valid directory has been saved. Toggle the input back to empty
> (placeholder only) for the pure first-run state.

---

## Component mapping (UI element → Mantine component)

### Settings → General tab (`frontend/src/components/settings/GeneralTab.tsx`)

The tab currently holds only a language `Select` inside `Stack gap="md" maw={320}`.
The backup section is added **below** it. Because the path `TextInput` is longer,
the panel widens to **`maw={520}`** (`.tab-panel`); the language `Select` keeps its
narrow width (`.field.narrow` → `maw={320}`).

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Tab panel container | `Stack gap="md" maw={520}` | widened from 320 to fit the path input |
| Language selector (existing) | `Select` | unchanged; stays at `maw={320}` |

#### Card: Backup (`.card` → `Card padding="md" radius="md"`)

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Section title | `Title order={4}` | "Backup" |
| Backup directory | `TextInput` | label "Backup directory", description "Absolute path where backups will be saved", full width |
| Save path | `Button variant="light" size="xs"` | below the input; saves via `PATCH /api/preferences` |
| Path error | `TextInput` `error` prop | inline orange error on 422 (path doesn't exist / not writable) |
| Backup reminder | `Select` | options: Every 7 / 14 / 30 days / Disabled; **auto-saves** `onChange` via `PATCH /api/preferences` |
| Last backup | `Text c="dimmed" fz="sm"` | "Last backup: June 22, 2026 at 14:30" or "Last backup: Never" |
| Back up now | `Button variant="filled"` | `disabled` when no backup directory configured (dimmed + `Tooltip`); `loading` while `POST /api/backup` runs |

#### Card: Restore (`.card`)

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Section title | `Title order={4}` | "Restore from backup" |
| File upload | `Dropzone` (`@mantine/dropzone`, `accept={['application/zip']}`) | label "Upload a backup file (.zip)". A plain `FileInput accept=".zip"` is an acceptable fallback. On a valid `.zip` → opens the restore Modal |

### Restore confirmation Modal (`Modal centered size="md"`)

Shown after the uploaded zip passes validation.

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Backdrop | `Modal` overlay (`overlayProps`) | dimmed `rgba(0,0,0,0.65)` |
| Title | `Modal.Title` | "Restore backup" |
| Summary | `Text` | "Backup from **{date}**, Kiroku **{version}** — **{n}** trades, **{m}** screenshots" (bold values = `Text span fw={600}`) |
| Version warning | `Alert color="orange" variant="light" icon={<IconAlertTriangle />}` | **only** when backup version > installed version |
| Destructive warning | `Text c="dimmed" fz="sm"` | "This will replace all current data. This action cannot be undone." |
| Cancel | `Button variant="default"` | closes the Modal |
| Restore | `Button color="red" variant="filled"` | destructive confirm — replaces all data |

Two variants: `settings-general-restore.html` (no warning) and
`settings-general-restore-warning.html` (with the orange version-mismatch Alert).

### Reminder banner (`frontend/src/components/AppLayout/AppLayout.tsx`)

Rendered inside `AppShell.Main`, **between** `<Box maw={1400} mx="auto">` and
`<Outlet />`. It is in normal document flow (NOT fixed/absolute) and pushes the
page content down when visible.

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Container | `Alert color="orange" variant="light" radius="md" icon={<IconAlertTriangle />}` | non-blocking, in-flow |
| Layout | `Group justify="space-between"` | message left, buttons right; stacks vertically `< sm` |
| Message | `Text` | "You haven't backed up your data yet" or "Your last backup was **{n} days** ago" |
| Back up now | `Button size="compact-sm" variant="filled"` | triggers `POST /api/backup` directly |
| Not now | `Button size="compact-sm" variant="subtle" c="dimmed"` | dismisses for 24 hours (localStorage) |

Three variants: `banner-never.html`, `banner-overdue.html`, `banner-mobile.html`
(stacked). The banner only renders when a reminder is due (per the configured
`Backup reminder` frequency) and not dismissed within the last 24 hours.

---

## Color usage (per DESIGN_SYSTEM.md)

| Use | Token | Where |
|-----|-------|-------|
| **Danger / destructive** | `red.6` (loss token) | **only** the "Restore" confirm `Button color="red"` (replaces all data) |
| **Warning accent** | `orange` | reminder banner, restore version-mismatch `Alert`, inline path-validation error |
| Brand / primary | `blue.6` | active nav/tab, "Save path" light button, "Back up now" filled buttons |
| Neutral / secondary | `dimmed` / default | "Last backup" line, "cannot be undone" line, "Not now" subtle button, field descriptions |

**Color decision — danger vs warning.** RED is reserved for the **destructive
action itself**: the filled "Restore" button, which permanently replaces all
current data. Every **warning** is ORANGE — the reminder banner, the
"created with a newer version" Alert, and the 422 path error. Per DESIGN_SYSTEM,
warnings are **never** red (red = financial loss / destructive only), form errors
use orange, and the P&L green/red semantic is **not used** anywhere on these
surfaces. "Back up now" is the primary (blue) action, not destructive.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS emulates Mantine responsive
props at `max-width: 768px`.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger header (`AppShell` collapsed) |
| Tabs strip | inline row | horizontally scrollable if it overflows |
| General tab panel | `maw={520}` | full width |
| Restore Modal | `size="md"` (~480px), centered | near full-width with side padding |
| Reminder banner | `Group` row (message left, buttons right) | **stacked** (message above, buttons below, right-aligned) |

`banner-mobile.html` applies `.banner.stacked` explicitly because the phone-frame
mockup is viewed on a desktop browser; in the app this is the `Group` switching to
a vertical stack at `sm` (e.g. `Stack` from `base`, `Group` from `sm`).

---

## i18n note (proposed keys + EN copy)

Every user-facing string maps to a `t(...)` key. EN is the source of truth
(`en.json`); all six locales mirror the structure. Dates/versions/counts are
interpolated with `{{...}}` and use `react-i18next` plurals for "day(s)".

### Settings — backup (`settings.backup.*`)
| Key | EN copy |
|-----|---------|
| `settings.backup.title` | `Backup` |
| `settings.backup.directory_label` | `Backup directory` |
| `settings.backup.directory_description` | `Absolute path where backups will be saved` |
| `settings.backup.directory_error` | `This path doesn't exist or isn't writable.` |
| `settings.backup.save_path` | `Save path` |
| `settings.backup.reminder_label` | `Backup reminder` |
| `settings.backup.reminder_description` | `Auto-saves on change` |
| `settings.backup.reminder.every_7` | `Every 7 days` |
| `settings.backup.reminder.every_14` | `Every 14 days` |
| `settings.backup.reminder.every_30` | `Every 30 days` |
| `settings.backup.reminder.disabled` | `Disabled` |
| `settings.backup.last_backup` | `Last backup: {{when}}` |
| `settings.backup.last_backup_never` | `Last backup: Never` |
| `settings.backup.backup_now` | `Back up now` |
| `settings.backup.backup_now_disabled_tooltip` | `Set a valid backup directory first` |

### Settings — restore (`settings.restore.*`)
| Key | EN copy |
|-----|---------|
| `settings.restore.title` | `Restore from backup` |
| `settings.restore.upload_label` | `Upload a backup file (.zip)` |
| `settings.restore.modal_title` | `Restore backup` |
| `settings.restore.summary` | `Backup from {{date}}, Kiroku {{version}} — {{trades}} trades, {{screenshots}} screenshots` |
| `settings.restore.version_warning` | `This backup was created with a newer version of Kiroku. Restoring may cause issues.` |
| `settings.restore.destructive_warning` | `This will replace all current data. This action cannot be undone.` |
| `settings.restore.confirm` | `Restore` |

### Reminder banner (`backup.reminder.*`)
| Key | EN copy |
|-----|---------|
| `backup.reminder.never` | `You haven't backed up your data yet` |
| `backup.reminder.overdue` | `Your last backup was {{count}} day ago` / *plural*: `Your last backup was {{count}} days ago` |
| `backup.reminder.backup_now` | `Back up now` |
| `backup.reminder.not_now` | `Not now` |

### Shared / common
| Key | EN copy |
|-----|---------|
| `common.actions.cancel` | `Cancel` |
| `settings.tabs.general` | `General` |

> Version strings (`v0.6.4`) and `.zip` filenames are not translated. "day(s)"
> uses i18next plural keys (`_one` / `_other`).

---

## Acceptance-criteria & deliverables checklist

- [x] Backup card — `Title order={4}`, path `TextInput` + description, "Save path" light button, inline 422 error, reminder `Select` (auto-save), "Last backup" line, "Back up now" `filled` (disabled + tooltip when no path).
- [x] Restore card — `Title order={4}`, `.zip` Dropzone/FileInput → opens Modal.
- [x] Restore Modal — centered `size="md"`, summary, destructive warning, Cancel (`default`) + Restore (`color="red" filled`); **two variants** (with / without orange version Alert).
- [x] Reminder banner — in-flow `Alert color="orange"` above `<Outlet/>`; "never" + "X days ago" + mobile stacked variants; "Back up now" (`POST /api/backup`) + "Not now" (24h dismiss).
- [x] Warnings in **orange** (`IconAlertTriangle`), red **only** for the destructive Restore confirm.
- [x] No hardcoded theme colors (all via `:root` vars mirroring Mantine tokens); 2-space indentation.
- [x] i18n keys proposed for every string with EN copy + plural note.
