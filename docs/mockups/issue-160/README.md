# Issue #160 — News settings + calendar news display (mockups)

Static HTML/CSS mockups for the **economic news** feature: a News section on the
Settings page, and news events rendered on the existing Journal calendar. No
React, no build. Structure mirrors Mantine components 1:1 so the `frontend-dev`
agent can translate directly. Colors/spacing come from `kiroku-mockup.css` CSS
variables that mirror Mantine's dark theme — in the real app these are Mantine
tokens (`var(--mantine-color-*)`), never hardcoded.

Reference: `docs/DESIGN_SYSTEM.md`. Base tokens/components copied from the latest
mockup (`docs/mockups/issue-147/kiroku-mockup.css`, which already carries the
issue-65 calendar + issue-129 account-toggle + issue-147 tabs styles). The
`.switch` and `.action-icon` components are ported verbatim from
`docs/mockups/issue-113`. News-specific styles are added below the
`ISSUE #160 ADDITIONS` banner in the CSS (this folder is self-contained — no
cross-folder imports).

## Files

| File | Purpose |
|------|---------|
| `news-settings.html` | Settings > News tab — master toggle, currency filter, min-impact control, last-sync + Sync button (ENABLED state) |
| `calendar-with-news.html` | June 2026 calendar with news: single-event day (Jun 12) + two multi-event days (Jun 10/11) with HoverCards closed; mobile agenda + legend |
| `calendar-with-news-hover.html` | Same calendar with the Jun 10 indicator's HoverCard OPEN (full list grouped by currency) |
| `kiroku-mockup.css` | Shared theme tokens + base components + news styles |

Open the HTML files directly in a browser. Resize below ~768px (Mantine `sm`)
to see the calendar switch to the vertical agenda layout (news renders inline,
no hover) and the settings checkbox group reflow.

---

## Component mapping (UI element → Mantine component)

### Settings > News (`news-settings.html`)
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Settings tab bar | `Tabs` + `Tabs.List` / `Tabs.Tab` | new **News** tab added after Emotions |
| Settings section card | `Card padding="md" radius="md"` | wraps all news controls |
| Setting row | `Box` / `Stack` with a label + control | `.setting`, divider between rows |
| Master toggle | `Switch` | label "Show economic news on calendar"; `description` text below; controls the disabled state of the rows below |
| Currency filter | `Checkbox.Group` of `Checkbox` | USD, EUR, GBP, JPY, CAD, AUD, CHF, NZD, CNY; codes in monospace; value = array of selected codes |
| Select all / None | `Anchor component="button"` | toggles the whole `Checkbox.Group` value between all / empty |
| Minimum impact level | `SegmentedControl` | `data={['High only','High + Medium','All']}`, default `High + Medium` |
| Last synced label | `Text size="sm" c="dimmed"` | relative time, e.g. "Last synced: 2h ago" |
| Sync now | `ActionIcon variant="light"` (`IconRefresh`) | manual re-sync; add `.spinning` (CSS keyframe) while a sync is in flight |
| Disabled dependent controls | `disabled` prop on each input | when the Switch is OFF, Currencies / Min impact / Sync get `.is-disabled` (dimmed + non-interactive) |

### Calendar news (`calendar-with-news.html`, `calendar-with-news-hover.html`)
| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Single news event (1/day) | `Box` (non-interactive) | `.news` pill: news glyph + `HH:mm` time + title (ellipsis). **No link** (unlike trade pills). Positioned ABOVE trade events |
| Multi-event indicator (2+/day) | `HoverCard` → `HoverCard.Target` | `.news-indicator`: calendar glyph + count; left border/tint by the day's HIGHEST impact |
| HoverCard dropdown | `HoverCard.Dropdown` | `.news-hover`; width ~280px; opens on hover/focus (desktop only) |
| Currency group header | `Group` + `Text fw={700}` | currency code + `(count)`; one per currency present that day |
| Event row (in dropdown) | `Group` | `HH:mm` (dimmed) + title (ellipsis) + impact dot/label; sorted by time within the group |
| Impact dot | `Box` / small `ThemeIcon` | 8px circle, colored by impact (red / orange / dimmed) |
| News glyph | `IconCalendarEvent` (`@tabler/icons-react`) | distinguishes news from trade pills at a glance |
| Legend | `Group` of swatch + `Text size="xs"` | maps the impact ramp + a trade swatch for contrast |
| Mobile (agenda) news | `.news` pill rendered inline | no HoverCard on touch — each event is its own pill, before trade events |

---

## Color usage (per DESIGN_SYSTEM.md)

News must **never** use the P&L semantic (green = profit, red = loss). Impact is
encoded with its **own ramp** so it can't be read as money:

| Use | Token | Where |
|-----|-------|-------|
| HIGH impact | `red.7` (`#e03131`, `--impact-high`) | left border of HIGH news pills/indicators; HIGH impact dots |
| MEDIUM impact | `orange.6` (`#f76707`, `--impact-med`) | left border of MEDIUM news; MEDIUM impact dots |
| LOW impact | `dark.3` (`#5c5f66`, `--impact-low`) | left border of LOW news (dimmed); LOW impact dots |
| News pill surface | `dark.6` (`#25262b`, `--news-bg`) | subtle background — distinct from trade pills' tinted green/red surfaces |
| Brand / primary | `blue.6` | Switch ON, checked checkboxes, active tab/segment, Sync `ActionIcon`, today's cell |
| Profit / loss (trades only) | `green.6` / `red.6` | trade event pills — **untouched** by this issue |

**Why HIGH `red.7` doesn't collide with loss `red.6`:** HIGH uses a *deeper*
red and is always paired with (a) the neutral `dark.6` pill surface — not the
red-tinted surface trade losses use, (b) a leading calendar/news glyph, and (c)
no link affordance. The combination reads as "event severity", not "losing
trade". Trade pills keep their existing green/red P&L semantics.

---

## Display rules (from the issue)

| Day has… | Rendering | Impact color source |
|----------|-----------|---------------------|
| 1 filtered news event | `.news` pill shown directly (`HH:mm` + title, no link) | the event's own impact |
| 2+ filtered news events | `.news-indicator` badge (glyph + count) with a HoverCard | the **highest** impact among the day's events |

The HoverCard groups events by currency (header = code + count), sorts events by
time within a group, and shows impact as a small colored dot. News always sits
**above** trade events in a day cell.

---

## Responsive behavior (Mantine breakpoints)

Breakpoint of interest: `sm` (~768px). The mockup CSS emulates Mantine
responsive props at `max-width: 768px`.

| Area | Desktop (≥ sm) | Mobile (< sm) |
|------|----------------|---------------|
| Navbar | sidebar (240px) | hamburger drawer |
| Settings checkbox group | wraps across the row | wraps to fewer columns; tap targets unchanged |
| **Calendar** | Mon–Fri grid | vertical **agenda** list |
| Multi-event news | indicator badge + **HoverCard** on hover/focus | **no hover**: each event rendered inline as a `.news` pill, before trade events |
| Single-event news | `.news` pill (single line, ellipsis) | `.news` pill (text wraps) |

### Why news renders inline on mobile

Touch devices have no hover, so the HoverCard pattern can't surface the event
list. Below `sm` the agenda therefore lists every news event directly as a pill
(same style as the desktop single-event display), placed before that day's trade
events. The `.news-hover` is force-hidden under the media query so a stray
focus/long-press can't reveal a floating card with nowhere to anchor.

---

## Sample data (June 2026 — matches the issue)

| Day | Events | Rendering |
|-----|--------|-----------|
| **Jun 10** (Wed, today) | Core CPI m/m (HIGH, USD, 08:30), CPI y/y (HIGH, USD, 08:30), BOC Overnight Rate (HIGH, CAD, 09:45) | indicator badge, HIGH tint; HoverCard groups USD (2) + CAD (1) |
| **Jun 11** (Thu) | Main Refinancing Rate (HIGH, EUR, 08:15), Core PPI m/m (HIGH, USD, 08:30), Unemployment Claims (MEDIUM, USD, 08:30) | indicator badge, HIGH tint (highest of the group); HoverCard groups EUR (1) + USD (2) |
| **Jun 12** (Fri) | Prelim UoM Consumer Sentiment (MEDIUM, USD, 10:00) | single `.news` pill (MEDIUM border), shown directly |

These coexist with the existing issue-65 trade events and weekly/monthly review
bands (Jun 12 keeps its `Weekly Review: +6.50R`), demonstrating that news and
trades share the same day cells without visual collision.

---

## Acceptance-criteria & deliverables checklist

### Mockup 1 — News settings
- [x] Master `Switch` "Show economic news on calendar".
- [x] Currency `Checkbox.Group` — USD/EUR/GBP/JPY/CAD/AUD/CHF/NZD/CNY + "Select all / None" helper.
- [x] `SegmentedControl` — High only / High + Medium / All.
- [x] Last-sync dimmed text + Sync `ActionIcon` (refresh icon).
- [x] Dependent controls dimmed/disabled when the toggle is off (`.is-disabled`, documented in the `news-settings.html` note).

### Mockup 2 — Calendar news display
- [x] Single event → news pill (time + title, no link), above trade events.
- [x] Pill border by impact: red (HIGH) / orange (MEDIUM) / dimmed (LOW); subtle `dark.6` background.
- [x] 2+ events → indicator badge (glyph + count), tinted by highest impact.
- [x] HoverCard on hover, grouped by currency (header = code + count), sorted by time, impact dots.
- [x] Mobile agenda → news rendered inline (no hover), before trade events.

### Design-system compliance
- [x] News colors use a dedicated impact ramp — green/red stay reserved for P&L.
- [x] Times/titles in the pills use monospace (consistent with calendar events).
- [x] No inline styles for components (only two layout `style=` width caps on the segmented control / view toggle, mirroring existing mockups); everything else in `kiroku-mockup.css`; 2-space indentation.
- [x] `@tabler/icons-react` glyphs; ActionIcon size 20.

### Deliverables
- [x] `news-settings.html`
- [x] `calendar-with-news.html`
- [x] `calendar-with-news-hover.html`
- [x] `kiroku-mockup.css` (self-contained, copied + extended from issue-147)
- [x] `README.md` (this file)
