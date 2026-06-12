# Issue #129 — Journal account-type toggles (Live / Demo / Test) (mockup)

Static HTML/CSS mockups extending the issue-65 Journal (calendar + list) with an
opt-in **account-type selector**. By default the Journal shows `live` trades
only; `demo` and `test` trades exist in the DB but are hidden. This issue adds a
toggle so the trader can pull Demo/Test trades into the **calendar** and **list**
views with a **visually distinct "doesn't count" treatment**, while the
**stat cards and weekly/monthly review bands stay `live`-only regardless of
toggle state**.

No React, no build. Structure mirrors Mantine 1:1 so `frontend-dev` can
translate directly. Colors/spacing come from `kiroku-mockup.css` CSS variables
that mirror Mantine's dark theme — in the real app these are Mantine tokens
(`var(--mantine-color-*)`), never hardcoded.

Reference: `docs/DESIGN_SYSTEM.md`. Base tokens/components copied **verbatim**
from `docs/mockups/issue-65/kiroku-mockup.css` (self-contained — no cross-folder
imports); issue-129 styles added below the `ISSUE #129 ADDITIONS` banner.

> Builds directly on issue #65's June 2026 sample data. "Today" is updated to
> **2026-06-12** (the current date). A few Demo and Test events are added on top
> of the existing Live trades.

## Files

| File | Purpose |
|------|---------|
| `journal-calendar.html` | Desktop, POPULATED, toggles ON — Live + Demo + Test intermixed in the Mon–Fri grid; stats + review bands visibly Live-only |
| `journal-list.html` | Desktop, POPULATED — adds an **Account** column; Demo/Test rows muted; stats Live-only |
| `journal-mobile.html` | Mobile (~390px frame) — toggles stacked below the view switch; agenda view with distinct Demo/Test events |
| `kiroku-mockup.css` | issue-65 base verbatim + `ISSUE #129 ADDITIONS` |
| `README.md` | This file |

Open the HTML files directly in a browser. Resize the desktop files below
~768px (Mantine `sm`) to see the toggles stack and the calendar switch to the
agenda list.

---

## Component mapping (UI element → Mantine component)

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| App shell / navbar | `AppShell` + `AppShell.Navbar` | "Journal" link active |
| Page header | `Group justify="space-between"` → `Title order={2}` + right `Group gap="sm"` | unchanged from #65 |
| Year selector | `Select w={120}` | **primary** data-scope control (unchanged) |
| Add trade | `Button variant="filled"` | unchanged |
| Stat cards (4-up) | `SimpleGrid cols={{ base: 2, sm: 4 }}` of `Card` | **always Live only** |
| "Live only" caption | `Group gap={5}` → `Badge` + `Text size="xs" c="dimmed"` | new — under the stat row and reviews |
| View switch | `SegmentedControl` (Calendar \| List, `maw` sm:320) | unchanged from #65 |
| **Account-type toggles** | **`Chip.Group` (multiple)** of `Chip variant="light"` | **recommended** — see below |
| Toggle label "Show:" | `Text size="xs" fw={600} c="dimmed" tt="uppercase"` | the only translatable surrounding label |
| Calendar | `TradeCalendar` — `Box visibleFrom="sm"` grid + `Box hiddenFrom="sm"` agenda | filter changes from `live`-only to "selected account types" for calendar/list |
| Trade event | `Link` with `.event` + `eventProfit/eventLoss/eventNeutral` | Live unchanged; Demo/Test add `.nonlive .demo/.test` + an account `Badge` |
| Weekly review band | dashed-border band on Friday cells | **Live only** — unchanged |
| Monthly review band | solid bold band on last trading day | **Live only** — unchanged |
| List table | `Table striped highlightOnHover fz="sm"` | adds an **Account** column (`Badge`) + muted row class for Demo/Test |
| Event legend | `Group` of swatch + `Text` | new — explains the 4 styles incl. missed_opportunity |

### Toggle pattern — recommended: `Chip.Group multiple` (justification)

The issue floated four options. Recommendation: **`Chip.Group` (multiple) of
light `Chip`s**, with **Live pinned on** (rendered selected and
non-deselectable) and **Demo / Test as opt-in chips**.

| Option | Verdict | Why |
|--------|---------|-----|
| **`Chip.Group` multiple (pills)** | ✅ **Recommended** | Multi-select by nature (Live + Demo + Test can all be on). Compact, reads as a filter, and lets us style Live (brand) vs Demo/Test (indigo "supp") *differently in the same control* — so "Live is primary, others supplementary" is visible in the control itself. Sits cleanly on the view toolbar. |
| `SegmentedControl` (multi) | ❌ | `SegmentedControl` is **single-select** in Mantine; it can't express "Live + Demo" simultaneously. A second multi-toggle would be needed — more components, same result as chips. |
| `MultiSelect` | ❌ | Hides the current selection behind a dropdown — a trader can't see at a glance which types are shown, and it reads as heavyweight for 3 fixed values. |
| Checkboxes / `Switch` group next to the year `Select` | ⚠️ Acceptable but rejected | Putting them next to the year `Select` blurs "primary vs supplementary" and crowds the header. Switches also imply a global on/off rather than a view filter. |

**Placement:** on the **view toolbar** (right of the Calendar/List
`SegmentedControl`), prefixed **"Show:"** — *not* in the header next to the year
`Select`. Rationale: the year `Select` changes the **data scope** (which year's
trades load); the account toggles only change **which of the loaded trades the
calendar/list renders** (stats/reviews ignore them). Grouping the toggles with
the view switch makes them read as a view-level filter and keeps them clearly
**secondary to the year `Select`** (smaller, labelled, on the toolbar).

---

## Color / visual-distinction usage (per DESIGN_SYSTEM.md)

| Trade kind | Border (left) | Opacity | P&L color | Badge | Reads as |
|------------|---------------|---------|-----------|-------|----------|
| **Live** | solid 3px green / red / dimmed | 100% | **semantic green / red / neutral** (unchanged) | none | "counts — real performance" |
| **Demo** | **dotted** 3px indigo (`--supp`) | ~78% | **dimmed** green/red tint (still legible) | `Demo` (indigo) | "doesn't count — but it was a win/loss" |
| **Test** | **dashed** 3px slate (`--border-strong`) | ~60% | **desaturated to neutral** (no green/red) | `Test` (neutral) | "doesn't count — throwaway data" |
| **missed_opportunity** (reference) | dashed 3px **amber** (`--orange`) + diagonal hatch, hollow | ~90% | amber | (its own status chip) | "a trade STATUS, not an account type" |

**Why Demo/Test can't be confused with `missed_opportunity`:**
`missed_opportunity` is a separate trade **status** (already excluded from stat
cards per issue #121). It uses the **amber/orange** family with a **hollow,
hatched** fill. Demo/Test use the **indigo "supp"** family with **solid muted
fills** + a **text badge** ("Demo"/"Test"). Different hue family (indigo vs
amber), different fill (solid-muted vs hollow-hatched), and an explicit account
badge — three independent signals, so the two never collide.

**Why indigo (`--supp`) for Demo/Test?** It carries **no financial semantic** in
this app (green=profit, red=loss, amber=warning/missed, blue=brand/primary are
all taken). Indigo (`indigo.4`) is adjacent to the brand blue but distinct, so
Demo/Test read as a *neutral system tag* — not a P&L color, not a warning.

**Live vs Demo P&L legibility.** Per the issue, Live keeps full green/red.
Demo keeps a **faded** green/red so the trader can still read win/loss at a
glance while the dotted border + reduced opacity + badge say "excluded". Test
goes one step further and **strips** the P&L color to neutral — test data is the
most disposable, so it deliberately loses all semantic emphasis.

**Live-only emphasis in the control.** The Live chip uses the **brand blue**
fill + a checkmark and is non-deselectable; Demo/Test chips use the muted
**indigo** accent. So even in the toggle UI, Live reads primary and the others
supplementary.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS emulates Mantine
responsive props at `max-width: 768px`.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger drawer (`AppShell` collapsed) |
| Stat cards | `cols={4}` | `cols={2}` (2×2) — still Live only |
| View toolbar | SegmentedControl **and** toggles on one row (`justify="space-between"`) | **stack**: toggles drop full-width **below** the SegmentedControl |
| Account toggles | inline chip row, right side | wrapped chip row under the view switch |
| Calendar | Mon–Fri 5-col grid (`visibleFrom="sm"`) | vertical **agenda** list (`hiddenFrom="sm"`) |
| Demo/Test events | dotted/dashed pill + badge in grid cell | same treatment, in agenda rows |
| Event legend | inline row | wraps to 2 lines |

### Responsive decision

The account toggles stack **below** the Calendar/List switch on mobile rather
than beside it: at 390px there isn't room for both on one line, and keeping the
view switch full-width (its established #65 behavior) is more important than
inlining the chips. The chips wrap and stay tappable (44px-ish targets).

---

## i18n (key list — all 6 locales: EN / FR / ES / IT / DE / PT)

Per `docs/I18N_GLOSSARY.md`, the **values** "Live", "Demo", "Test" stay in
**English in every language** (they are trading/system terms). Only the
surrounding label translates.

| Key | EN value | Translatable? |
|-----|----------|---------------|
| `journal.account_type.label` | `Show:` | ✅ translate (e.g. FR `Afficher :`, DE `Anzeigen:`, ES `Mostrar:`, IT `Mostra:`, PT `Mostrar:`) |
| `journal.account_type.live` | `Live` | ❌ English in all locales (glossary) |
| `journal.account_type.demo` | `Demo` | ❌ English in all locales |
| `journal.account_type.test` | `Test` | ❌ English in all locales |
| `journal.account_type.live_locked_hint` | `Live is always shown` | ✅ translate (tooltip on the locked Live chip) |
| `journal.stats.live_only_caption` | `Live only — excludes Demo & Test` | ✅ translate ("Live" token stays English) |
| `journal.list.header.account` | `Account` | ✅ translate (column header) |
| `journal.legend.live` | `Live (counts in stats & reviews)` | ✅ translate, "Live" stays English |
| `journal.legend.demo` | `Demo (excluded)` | ✅ translate, "Demo" stays English |
| `journal.legend.test` | `Test (excluded)` | ✅ translate, "Test" stays English |
| `journal.legend.missed` | `Missed opportunity (status, not an account type)` | ✅ translate fully |

All 6 locale files must carry the **identical key structure** (EN is the source
of truth). The account-type **values** are byte-identical across locales.

---

## Design rationale (summary)

1. **Toggle = `Chip.Group multiple`, on the view toolbar, "Live" pinned.**
   Multi-select is required (Live can coexist with Demo/Test); chips show the
   active selection inline; Live styled as brand/primary and Demo/Test as muted
   indigo so the control itself communicates the hierarchy. Placed with the view
   switch (not the year `Select`) because it filters the *view*, not the data
   scope — keeping it clearly secondary.
2. **Demo/Test visual treatment = muted indigo, dotted (demo) / dashed (test)
   border, reduced opacity, account badge.** Live is untouched (full green/red).
   Demo fades the P&L tint; Test strips it to neutral. This reads as
   "doesn't count" at a glance while staying legible, and the indigo + badge make
   it unmistakably different from the amber, hollow-hatched `missed_opportunity`.
3. **Stats + reviews stay Live-only.** Enforced in the component layer (the
   reviews/stats keep filtering `account_type === 'live'`); only the
   calendar/list rendering filter changes. Explicit **"Live only"** captions sit
   under the stat row and are reinforced in the `.note` — so the exclusion is
   visible, not just implied.

---

## Acceptance-criteria checklist (mockup)

| Criterion | Satisfied where |
|-----------|-----------------|
| Account-type toggles visible and clearly secondary to year selector | View toolbar in all 3 HTML files: `Chip.Group` with "Show:" label, smaller than the header year `Select`; Live chip locked/primary |
| Demo/Test trades visually distinct from Live in calendar | `journal-calendar.html` grid + agenda: `.event.nonlive.demo` (dotted indigo, faded) / `.test` (dashed, desaturated) + account badge |
| Demo/Test trades visually distinct from Live in list view | `journal-list.html`: new **Account** column badge + `.row-demo` / `.row-test` muted rows (indigo inset accent, reduced opacity, P&L fade/desaturate) |
| Stats cards and reviews unchanged regardless of toggle state | All files: 4 stat cards + weekly/monthly review bands carry a **"Live only"** caption; `.note` states they always exclude Demo/Test |
| Mobile responsive layout | `journal-mobile.html` (390px frame): toggles stack below the view switch; agenda view with distinct Demo/Test events; stats 2×2 |
| README with component mapping and design rationale | This file |
| i18n notes for toggle labels in all 6 locales | i18n section above — values "Live/Demo/Test" stay English, surrounding labels translate |
| Demo/Test not confused with missed_opportunity | Indigo (Demo/Test) vs amber hollow-hatched (missed) — documented in the color table + shown in the legend |

**Note:** Stat cards and weekly/monthly reviews stay **Live only** in every
view, regardless of which account-type toggles are on.
