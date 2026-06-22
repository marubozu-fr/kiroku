# Issue #178 — General tab layout consistency (mockup)

Static HTML/CSS mockup for fixing the **Settings → General** tab layout
inconsistency: the language `Select` sits outside any container while the
**Backup** and **Restore** sections are each wrapped in a `Card`. That made the
language field look orphaned and the page unbalanced.

**The fix:** wrap the language `Select` in the **same `Card`** the other two
sections already use, so all three sections share one consistent treatment.

No React, no build. Structure mirrors Mantine 1:1 so the `frontend-dev` agent can
translate directly. Colors/spacing come from `kiroku-mockup.css` CSS variables
that mirror Mantine's dark theme — in the real app these are Mantine tokens
(`var(--mantine-color-*)`), never hardcoded. The stylesheet is carried over
verbatim from `docs/mockups/issue-172/` (this folder is self-contained — no
cross-folder imports). **Issue #178 adds no new CSS:** the language card reuses
the existing `.card` + `.section-title` + `.field.narrow` classes.

Reference: `docs/DESIGN_SYSTEM.md` and `docs/designs/APP_DESIGN.md`.

## Files

| File | Variant shown |
|------|---------------|
| `settings-general.html` | General tab — **all three sections in cards**: Language card + Backup card + Restore card |
| `kiroku-mockup.css` | Shared theme tokens + base components (from issue-113) + backup/restore styles (from issue-172). No issue-178 additions. |

Open the HTML file directly in a browser.

Per the issue scope, **one mockup file is sufficient** (desktop only). Mobile
behavior follows from Mantine responsive props — the `Card`s and the `Stack`
already collapse to full width below `sm`, so no dedicated mobile mockup is needed.

---

## Before / after

| | Before | After |
|---|--------|-------|
| Language | standalone `Select`, no container | inside a `Card withBorder` with `Title order={4}` |
| Backup | `Card withBorder` | `Card withBorder` (unchanged) |
| Restore | `Card withBorder` | `Card withBorder` (unchanged) |

The orphaned field is gone: the General tab now reads as three peer cards stacked
in the `maw={520}` panel.

---

## Component mapping (UI element → Mantine component)

### Settings → General tab (`frontend/src/components/settings/GeneralTab.tsx`)

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Tab panel container | `Stack gap="md" maw={520}` | unchanged |
| **Language card** (`.card`) | `Card withBorder padding="md" radius="md"` | **NEW** — matches the Backup/Restore cards exactly |
| Card title | `Title order={4}` | text = `t('settings.general.language_label')` ("Language") |
| Language selector | `Select` | keeps `maw={320}`; **drops** its now-redundant `label` prop, keeps `description` |

The Backup and Restore cards are unchanged (`Card withBorder padding="md" radius="md"`
with their `Title order={4}` and existing fields — see `docs/mockups/issue-172/`).

### Implementation diff (GeneralTab.tsx)

Replace the standalone `Select` at the top of the returned `Stack`:

```tsx
<Select
  label={t('settings.general.language_label')}
  description={t('settings.general.language_description')}
  data={LANGUAGE_OPTIONS}
  value={current}
  onChange={handleLanguageChange}
  allowDeselect={false}
  maw={320}
/>
```

with a `Card` wrapper that mirrors the Backup/Restore cards:

```tsx
<Card withBorder padding="md" radius="md">
  <Stack gap="md">
    <Title order={4}>{t('settings.general.language_label')}</Title>
    <Select
      description={t('settings.general.language_description')}
      data={LANGUAGE_OPTIONS}
      value={current}
      onChange={handleLanguageChange}
      allowDeselect={false}
      maw={320}
    />
  </Stack>
</Card>
```

The `label` prop is removed because the card `Title` now serves as the section
heading — keeping both would print "Language" twice. The `description`
("Choose the display language") stays as the `Select`'s description. No new
imports are needed (`Card`, `Stack`, `Title`, `Select` are already imported).

---

## Color usage (per DESIGN_SYSTEM.md)

This change is **structural only** — it introduces no new colors. The Language
card uses the same neutral surface (`dark.6` card on `dark.7` body, `dark.4`
border) as every other card. The existing color semantics on this page are
unchanged (red = the destructive Restore confirm only; orange = warnings; blue =
primary actions).

---

## Responsive behavior (Mantine breakpoints)

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| General tab panel | `maw={520}` | full width |
| Language / Backup / Restore cards | stacked, full panel width | stacked, full width (cards already fluid) |
| Language `Select` | `maw={320}` inside its card | shrinks with the card |

No responsive props change: the new card behaves exactly like the existing two.

---

## i18n note (no new keys)

The fix **reuses existing keys** — nothing to add to the six locale files:

| Key | EN copy | Used as |
|-----|---------|---------|
| `settings.general.language_label` | `Language` | the card `Title order={4}` |
| `settings.general.language_description` | `Choose the display language` | the `Select` description |

The only change is moving `settings.general.language_label` from the `Select`'s
`label` prop to the card `Title`. EN stays the source of truth; no structural
change across locales.

---

## Acceptance-criteria & deliverables checklist

- [x] Language `Select` wrapped in a `Card withBorder padding="md" radius="md"` — same as Backup/Restore.
- [x] Card carries a `Title order={4}` ("Language"); redundant `Select` label removed, description kept.
- [x] Backup and Restore cards untouched; all three sections now receive consistent treatment.
- [x] Panel stays `Stack gap="md" maw={520}`; language `Select` stays `maw={320}`.
- [x] One self-contained mockup folder at `docs/mockups/issue-178/`, same conventions as `issue-172/`.
- [x] No hardcoded theme colors (all via `:root` vars mirroring Mantine tokens); 2-space indentation.
- [x] No new i18n keys; existing keys reused.
