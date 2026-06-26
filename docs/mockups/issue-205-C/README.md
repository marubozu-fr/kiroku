# Issue #205-C — Settings refactor: Chart Data provider selector

Static HTML/CSS mockup for the Settings → General **Chart Data** section. This
**design-only** issue introduces a dedicated *Chart Data* card with a provider
selector, replacing the standalone *Massive API Key* card from issue #183 and
preparing the Settings layout for future market-data providers.

No React, no build, **no production code** — implementation is handled by
**#205-B** (frontend routing to check provider + API key). Structure mirrors
Mantine 1:1 so the `frontend-dev` agent can translate directly. Colors/spacing
come from `kiroku-mockup.css` CSS variables that mirror Mantine's theme tokens —
in the real app these are Mantine tokens (`var(--mantine-color-*)`), never
hardcoded. The base stylesheet is carried over verbatim from
`docs/mockups/issue-183/`; **issue #205-C adds the Chart Data styles + a light
theme scope** under the `ISSUE #205-C ADDITIONS` banner (the folder is
self-contained — no cross-folder imports).

Reference: `docs/DESIGN_SYSTEM.md`. Open `settings-chart-data.html` directly in a
browser.

## Files

| File | Shows |
|------|-------|
| `settings-chart-data.html` | The **Chart Data** card in five previews: **A** Desktop · Dark · provider = Massive (full General-tab context — Language → Chart Data → Backup); **B** Desktop · Light · Massive (theme parity, enabled); **C** Desktop · Dark · provider = None (chart data **disabled** → info callout, no API-key field); **D** Desktop · Light · None (disabled callout in light theme); **E** Mobile · Light · Massive (responsive, phone frame). |
| `kiroku-mockup.css` | Shared theme tokens + base components (from issue-183) **+ issue-205-C additions** (light-theme scope, provider config block, info callout, mockup preview chrome). |

The panels are stacked in one page using mockup-only preview chrome
(`.preview-grid`, `.preview-col`, `.preview-label`) so reviewers see every state
side by side. That chrome is layout scaffolding, **not** app UI.

---

## What changes vs. issue #183

Issue #183 put the Massive API key in its own *Market data* card with a single
`PasswordInput`. Issue #205-C **wraps that key in a provider-scoped section**:

- The card title becomes **Chart Data** (not "Market data").
- A **Provider** `Select` is the first control. It decides what (if anything)
  renders below it.
- The Massive `PasswordInput` is now **conditional** — it shows only when
  `provider === 'massive'`.
- When `provider === 'none'`, no key field renders; an **info callout** explains
  that charts are disabled.

---

## Component mapping (UI element → Mantine component)

Target: `GeneralTab` (`frontend/src/components/settings/GeneralTab.tsx`). The
existing Language / Backup / Restore cards are unchanged; the *Market data* card
(lines ~246–268 today) is replaced by the **Chart Data** card below.

| UI element | Mantine component | Notes |
|------------|-------------------|-------|
| Card container (`.card`) | `Card withBorder padding="md" radius="md"` | Sits between the Language card and the Backup card |
| Section title (`.section-title`) | `Title order={4}` | `t('settings.chart_data.title')` → "Chart Data" |
| Provider selector (`.field.narrow > select`) | `Select` `maw={320}` `allowDeselect={false}` | `label` = "Provider"; `data` = provider list (below); future providers are `{ disabled: true }` items |
| Provider help (`.provider-hint`) | `Select` `description` **or** `Text c="dimmed" fz="xs"` | "Chart data is optional. Disable to use Kiroku without market data." |
| Provider config block (`.provider-config`) | conditional render | `{provider === 'massive' && <MassiveConfig/>}` — top border separates it from the Select |
| Massive API key (`.input-with-toggle`) | `PasswordInput` | `label` = "Massive API Key"; show/hide via Mantine's built-in `visibilityToggleIcon` |
| Help + signup link (`.field-desc a`) | `Anchor target="_blank" rel="noopener noreferrer" fz="sm"` | "Get a free API key" → `MASSIVE_SIGNUP_URL` (`https://massive.com/dashboard/signup`) |
| Save key (`.btn.filled.sm`) | `Button variant="light" size="xs"` | Reuses the existing `handleSaveApiKey` (PATCH `/api/preferences`, then validates) |
| Disabled callout (`.callout.info`) | `Alert variant="light" color="blue"` | Shown when `provider === 'none'`; icon = `IconInfoCircle` |

### Provider list (the Select `data`)

```ts
const PROVIDERS = [
  { value: 'none',     label: t('settings.chart_data.provider_none') },     // "None — chart data disabled"
  { value: 'massive',  label: 'Massive' },
  { value: 'hyperliquid', label: t('settings.chart_data.coming_soon', { name: 'Hyperliquid' }), disabled: true },
  { value: 'ib',          label: t('settings.chart_data.coming_soon', { name: 'Interactive Brokers' }), disabled: true },
]
```

Provider names (Massive, Hyperliquid, Interactive Brokers) stay in English in all
locales — they are proper nouns (cf. `docs/I18N_GLOSSARY.md`). Only the
`none`/`coming_soon` wrappers are translated.

---

## Provider selection logic & future extensibility

This is the documentation called for by the acceptance criteria. The design is a
**registry + conditional config** pattern: the provider list drives the Select,
and each provider that needs configuration owns a small config block gated on the
selected value.

**To add a future provider (e.g. Hyperliquid):**

1. Flip its `disabled: true` to enabled (or add a new entry) in `PROVIDERS`.
2. Add its config block beside the Massive one:
   `{provider === 'hyperliquid' && <HyperliquidConfig/>}`. Each block renders its
   own fields (API key, endpoint, account id — whatever that provider needs).
3. Add the i18n keys for any new labels/help text.
4. Persist the selection. Suggested preference shape (decided in **#205-B**, not
   here): a `chart_data_provider` string alongside the existing per-provider
   credentials (`massive_api_key`, future `hyperliquid_api_key`, …). `'none'`
   means chart data is disabled and downstream chart fetches are skipped.

The selector stays a flat list; no provider knows about another. A provider is
"installed" by adding one list entry plus one config block — no changes to the
Select, the callout, or the surrounding cards.

**Disabled state behavior** (`provider === 'none'`): the API-key field is hidden,
the info callout renders, and (per #205-B) the app does not attempt to load
candles — trade pages fall back to the existing chart empty state.

---

## i18n keys (new — to add in #205-B)

EN is the source of truth; mirror into FR/ES/IT/DE/PT. Reuse the existing
`settings.general.massive_api_key_*` keys for the Massive field where possible.

| Key | EN value |
|-----|----------|
| `settings.chart_data.title` | Chart Data |
| `settings.chart_data.provider_label` | Provider |
| `settings.chart_data.provider_none` | None — chart data disabled |
| `settings.chart_data.coming_soon` | {{name}} — coming soon |
| `settings.chart_data.optional_hint` | Chart data is optional. Disable to use Kiroku without market data. |
| `settings.chart_data.disabled_title` | Chart data is disabled |
| `settings.chart_data.disabled_body` | Trades won't display price charts. Select a provider above to enable market data. |
| `settings.general.massive_api_key_link` | Get a free API key *(existing — reused)* |

---

## Responsive notes

- **Desktop:** the General `tab-panel` keeps `maw={520}` (Stack gap="md"). The
  Provider `Select` is `maw={320}` (`.field.narrow`); the API-key `PasswordInput`
  spans the card width.
- **Mobile (≤768px, Mantine `sm`):** the sidebar collapses to the hamburger
  drawer, the tab strip scrolls horizontally, and the panel goes full-width
  (`.tab-panel { max-width: 100% }`) — all inherited from the base stylesheet.
  Panel **D** previews this in the `.phone-frame`. The provider config block and
  callout reflow naturally; nothing is fixed-width.
- The mockup's `.preview-grid` collapses from two columns to one at ≤900px so the
  preview page itself stays readable on narrow screens.

## Theme notes

Both themes are previewed from the **same markup** — only the wrapper class
differs (`.theme-light`). In the app, Mantine's color scheme drives this; the
tokens are never hardcoded. Per `docs/DESIGN_SYSTEM.md`, the disabled-state
callout is **informational** (neutral/blue `Alert variant="light"`), **not**
orange — orange stays reserved for warnings, red for destructive actions.
