# Issue #147 — Emotions onboarding empty state + trade-form nudge (mockup)

Static HTML/CSS mockups for the two **zero-emotions** entry points in Kiroku.
When a new user has no emotions configured, we offer importing a curated starter
set of **42 trading emotions across 5 categories** (from TraderPro) to reduce
onboarding friction.

1. **Settings > Emotions tab** — a full **inline onboarding** empty state
   (shown when `totalEmotions === 0`). It **replaces** the plain `DataStates`
   "No emotions yet" `Center`/`Text` empty state. It is **not** a modal/overlay
   — it sits inline in the tab body where the empty state was.
2. **Trade form** — a lightweight `Alert` **nudge** below the emotion
   `MultiSelect` (shown when `emotionOptions.length === 0`).

No React, no build. Structure mirrors Mantine 1:1 so `frontend-dev` can
translate directly. Colors/spacing come from `kiroku-mockup.css` CSS variables
that mirror Mantine's dark theme — in the real app these are Mantine tokens
(`var(--mantine-color-*)`), never hardcoded.

Reference: `docs/DESIGN_SYSTEM.md`. Base tokens/components copied **verbatim**
from `docs/mockups/issue-129/kiroku-mockup.css` (self-contained — no cross-folder
imports); issue-147 styles added below the `ISSUE #147 ADDITIONS` banner.

## Files

| File | Purpose |
|------|---------|
| `emotions-onboarding.html` | Settings > Emotions onboarding empty state. Desktop **State A** (onboarding), reference **State B** (post-skip standard empty state + "+ New emotion"), and a ~390px **mobile** frame. |
| `trade-form-nudge.html` | Trade-form emotion `MultiSelect` (empty) + the compact `Alert` nudge + Notes section. Desktop and a ~390px **mobile** frame. |
| `kiroku-mockup.css` | issue-129 base verbatim + `ISSUE #147 ADDITIONS` |
| `README.md` | This file |

Open the HTML files directly in a browser. Each file stacks its desktop layout
above a `.phone-frame` (~390px) mobile version, so both breakpoints are visible
at once. Resize the desktop section below ~768px (Mantine `sm`) to see the
language Select / Alert button go full-width.

> No placeholder statistics are introduced. The only numbers shown
> (**42 emotions / 5 categories**) describe the fixed size of the curated
> starter set being imported — not user data.

---

## No new colors (DESIGN_SYSTEM.md compliance)

This issue introduces **zero** new colors. Everything reuses existing tokens:

| Surface | Color used | Why it's allowed |
|---------|-----------|------------------|
| Onboarding icon + secondary copy | `--dimmed` | The app's standard empty-state treatment (dimmed icon + text). |
| "Import emotions" CTA | `--primary` (brand blue, `variant="filled"`) | Primary action per DESIGN_SYSTEM "Buttons". Not green — green is reserved for P&L. |
| "Or start from scratch" link | `--primary` (Anchor) | Standard link color. |
| Trade-form `Alert` | brand blue family (`color="blue"`, `variant="light"`) | Informational nudge — reuses the same blue as `.badge.open` / `.navlink.active`. **Not** green/red (reserved for P&L), **not** orange (reserved for errors/warnings). |

Semantic green/red are untouched — neither surface displays any financial value,
so neither uses profit/loss colors.

---

## Component mapping (UI element → Mantine component)

### Entry point 1 — Settings > Emotions onboarding (`emotions-onboarding.html`)

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| App shell / navbar | `AppShell` + `AppShell.Navbar` | "Settings" link active |
| Settings tabs | `Tabs` / `Tabs.Tab` | "Emotions" active — unchanged |
| Onboarding container | `Stack align="center" gap="sm"` inside the tab body | Replaces the `DataStates` empty branch when `totalEmotions === 0`. Cap width ~`maw={460}`. |
| Dimmed icon | `IconMoodSmile` (or `IconBrain`) `size={52}` `color="dimmed"`/`opacity` | Matches the app's dimmed empty-state icon convention. |
| Title | `Title order={3}` (or `Text fw={700} fz="xl"`) | "Get started with curated trading emotions" |
| Description | `Text c="dimmed" ta="center" maw={420}` | The 2-sentence copy. |
| Language Select | `Select w={280}` `label` above, defaults to current Kiroku language | Positioned **above** the CTA. 6 fixed options (see i18n note — language **names** are not translated). |
| Import count | `Text size="sm" c="dimmed"` | "42 emotions across 5 categories" — informational. |
| Primary CTA | `Button variant="filled"` (brand) `size="md"` | "Import emotions" — bulk import in the selected language. |
| Skip link | `Anchor component="button" type="button" size="sm"` | "Or start from scratch" — sets local `dismissed` state → renders the standard empty state. |
| State B "+ New emotion" | `Button leftSection={<IconPlus/>}` | The existing `EmotionsTab` add button (top-right `Group justify="flex-end"`). Hidden during onboarding (State A), restored after skip (State B). |
| State B empty body | existing `DataStates` empty branch (`Center`/`Text c="dimmed"`) | Unchanged — the current `settings.emotions.empty` message. |

**Wiring note (for the implementation issue):** `EmotionsTab` gains a local
`onboardingDismissed` boolean. When `totalEmotions === 0 && !onboardingDismissed`,
render the onboarding instead of passing through to `DataStates`'s empty branch
**and** hide the top-right "+ New emotion" button. "Or start from scratch" sets
`onboardingDismissed = true` (component state only — no persistence needed; a
fresh mount re-offers onboarding while still empty). A successful import reloads
the grouped list and the populated table renders normally.

### Entry point 2 — Trade-form nudge (`trade-form-nudge.html`)

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Emotion field | `MultiSelect` (existing) + `ActionIcon` "+" | Unchanged. When `emotionOptions.length === 0` it's already `disabled` with the `emotions_placeholder_empty` placeholder. |
| Nudge | `Alert variant="light" color="blue"` | Compact. Rendered **directly below** the emotion `Group` (MultiSelect + ActionIcon), **before** the Notes `Card`. |
| Nudge icon | `IconInfoCircle size={18}` | Alert `icon` prop. |
| Nudge message | `Text size="sm"` (Alert body) | "No emotions configured yet. Import our starter set to get started, or add your own in Settings." |
| Inline import button | `Button variant="light" size="xs"` | "Import starter set" — bulk import in the **current Kiroku language** (no picker). |

**Wiring note:** the nudge lives inside the Configuration `Card`, after the
emotion `Group`. Show it only when `emotionOptions.length === 0`. "Import starter
set" calls the same bulk-import endpoint as the onboarding CTA (language =
current `i18n.language`), then `emotions.reload()`; once options exist the
`emotionOptions.length === 0` guard hides the Alert and re-enables the
`MultiSelect`. The existing inline "+" (`EmotionModal`) stays as the manual path.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS emulates Mantine
responsive props at `max-width: 768px`; each HTML file also embeds a ~390px
`.phone-frame` so the mobile layout is visible without resizing.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger drawer (`AppShell` collapsed) |
| Onboarding column | centered, `maw≈460` | same centered column, reduced padding |
| Language Select | `w≈280` | **full-width** |
| "Import emotions" CTA | auto width | **full-width**, tappable |
| Trade-form Card | `maw≈560` (left form column) | full-width (`base: 12` grid col) |
| Alert | icon · message · button inline group | button **stacks full-width** below the message |

### Responsive decisions

- **Onboarding stays one centered column** at every width — it's already narrow,
  so mobile only widens the Select/CTA to full width for tap targets. No layout
  reflow needed.
- **Alert actions stack on mobile.** At 390px the inline button would crowd the
  message, so "Import starter set" drops full-width beneath the text (keeping the
  Alert compact and the tap target large). On desktop it stays inline to keep the
  nudge a single tidy band.
- The nudge is **compact and inline** (not a full card) specifically so it
  doesn't push the surrounding form fields around — it reads as an aside between
  the emotion field and Notes.

---

## i18n (key list — all 6 locales: EN / FR / ES / IT / DE / PT)

Per project i18n conventions: dot-separated, page-scoped keys; `settings.*` and
`trade.*` for page-specific strings, `common.*` for shared. EN (`en.json`) is the
source of truth; all 6 locale files carry the **identical** key structure.

Per `docs/I18N_GLOSSARY.md`, trading terms stay English in all locales — but
**none** of the strings below are glossary terms, so all values translate
normally. The interpolated `{{count}}` / `{{categories}}` use the
`{{variable}}` syntax.

### Settings > Emotions onboarding (`settings.emotions.onboarding.*`)

| Key | EN value |
|-----|----------|
| `settings.emotions.onboarding.title` | `Get started with curated trading emotions` |
| `settings.emotions.onboarding.description` | `We've assembled the most common emotional states, mental triggers, and execution patterns that traders experience. Import them as a starting point — you can always add, edit, or remove any of them later.` |
| `settings.emotions.onboarding.language_label` | `Import language` |
| `settings.emotions.onboarding.count` | `{{count}} emotions across {{categories}} categories` |
| `settings.emotions.onboarding.import` | `Import emotions` |
| `settings.emotions.onboarding.skip` | `Or start from scratch` |
| `settings.emotions.onboarding.import_success` | `Imported {{count}} emotions` |
| `settings.emotions.onboarding.import_error` | `Could not import emotions. Please try again.` |

> The existing `settings.emotions.empty` ("No emotions yet…") and
> `settings.emotions.add` ("+ New emotion") keys are reused unchanged for
> **State B** (post-skip). No changes to them.

### Trade-form nudge (`trade.form.emotions_nudge.*`)

| Key | EN value |
|-----|----------|
| `trade.form.emotions_nudge.message` | `No emotions configured yet. Import our starter set to get started, or add your own in Settings.` |
| `trade.form.emotions_nudge.import` | `Import starter set` |
| `trade.form.emotions_nudge.import_success` | `Imported {{count}} emotions` |
| `trade.form.emotions_nudge.import_error` | `Could not import emotions. Please try again.` |

### Language Select options

The six language **names** are displayed in their own language (endonyms:
`English`, `Français`, `Español`, `Italiano`, `Deutsch`, `Português`) and are
**not** translated per-locale — they render identically in every locale, matching
how language pickers conventionally behave. These come from the existing
language list (the same one backing `kiroku-language` in `localStorage`), so no
new i18n keys are needed for the option labels.

---

## Design rationale (summary)

1. **Onboarding replaces the empty state inline (not a modal).** Per the issue,
   it sits where `DataStates`'s empty branch was. Built from the existing
   `.empty-state` pattern (dimmed icon + title + description) and extended with
   the interactive block (Select → count → CTA → skip). The top-right
   "+ New emotion" button is suppressed during onboarding so there's one clear
   primary action; it returns after "start from scratch".
2. **Language Select above the CTA, defaulting to the current Kiroku language.**
   The user can switch the import language before committing. The import-count
   line sits between Select and CTA as quiet confirmation of what will be added.
3. **Trade-form nudge is a compact `Alert`, blue/light, inline.** Fast path: no
   language picker (imports in the current language) so it never interrupts trade
   entry. It sits between the emotion field and Notes, stacks its button on
   mobile, and disappears the moment emotions exist.
4. **Color discipline.** Blue (info) for the Alert; brand blue for the CTA;
   dimmed for empty-state chrome. No green/red (reserved for P&L), no orange
   (reserved for errors/warnings) — fully DESIGN_SYSTEM-compliant.

---

## Acceptance-criteria checklist (mockup)

| Criterion | Satisfied where |
|-----------|-----------------|
| Settings onboarding with icon, copy, language selector, import button, skip link | `emotions-onboarding.html` State A (`.onboarding`) |
| Skip reveals standard empty state + "+ New emotion" | `emotions-onboarding.html` State B (`.plain-empty` + button) |
| Trade-form nudge with Alert, message, inline import button | `trade-form-nudge.html` (`.alert`) below the emotion `MultiSelect`, before Notes |
| Both responsive (desktop + mobile at `sm`) | Each HTML file embeds a `.phone-frame` mobile section; CSS `@media (max-width: 768px)` rules |
| README with Mantine component mapping + i18n keys | This file |
| Follows DESIGN_SYSTEM.md (dark theme, tokens, semantic colors) | "No new colors" section — blue info / brand CTA / dimmed chrome only |
