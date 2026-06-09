# Kiroku Design System

Single source of truth for all visual decisions. Every frontend component must comply.

---

## Foundation: Mantine Dark Theme

Kiroku uses Mantine's built-in dark theme as its base. Do NOT define custom colors for
standard UI elements (backgrounds, borders, text, inputs) — let Mantine handle them.

This guarantees readability, accessibility, and consistency out of the box.

**Override Mantine only for trading-specific semantics.**

---

## Trading-Specific Overrides

### Semantic Colors

These are the ONLY custom colors in the app:

| Token | Value | Usage |
|-------|-------|-------|
| `profit` | `green.6` (Mantine green) | Positive P&L, winning trades, equity going up |
| `loss` | `red.6` (Mantine red) | Negative P&L, losing trades, equity going down |
| `neutral` | `dimmed` (Mantine dimmed) | Break-even, pending, no data |

**Rules:**
- Green = money gained. Red = money lost. No exceptions, no other meanings.
- Form errors use `orange` — NOT red. Red is reserved for financial loss.
- Success toasts use Mantine default — NOT green. Green is reserved for profit.

### Financial Numbers

All prices, P&L, percentages, and R values use monospace:
- **Font**: `JetBrains Mono` (fallback: `SF Mono, Consolas, monospace`)
- **Alignment**: Right-aligned in tables
- **Color**: Semantic (green for positive, red for negative, default for neutral)
- **Format**: Always show sign for P&L (`+125.00` / `-42.50`)

---

## Layout

### App Shell
- Use Mantine `AppShell` with navbar (sidebar) and main content area
- Navbar: collapsible, icons + labels
- Main content: fluid width with `maw={1400}` and centered

### Data Density
- Traders want to see information, not whitespace
- Use Mantine's `fz="sm"` `verticalSpacing="xs"` for tables and compact data views
- Cards: use Mantine `Card` with `padding="md"`
- Prefer tables over card grids for list data

### Responsive
- Use Mantine breakpoints: `xs`, `sm`, `md`, `lg`, `xl`
- Sidebar collapses to hamburger on mobile
- Tables become scrollable horizontally on small screens

---

## Component Guidelines

### Tables
- Use Mantine `Table` with `striped` and `highlightOnHover`
- Monospace for numeric columns, right-aligned
- P&L columns colored with semantic tokens
- Header: uppercase, `size="xs"`, `color="dimmed"`

### Cards (Dashboard)
- Mantine `Card` with `shadow="sm"` and `radius="md"`
- Key metric value: `size="xl"`, `fw={700}`, monospace
- Label: `size="sm"`, `color="dimmed"`

### Forms
- Mantine form components (`TextInput`, `NumberInput`, `Select`, etc.)
- Labels above inputs
- Error messages in orange (`color="orange"`)
- Use `useForm` hook from `@mantine/form`

### Buttons
- Primary action: `variant="filled"` (Mantine primary color)
- Secondary action: `variant="default"`
- Danger action: `variant="filled"` with `color="red"`
- Consistent sizing within the same context

### Charts
- TradingView Lightweight Charts for candlestick/line charts
- Match chart background to Mantine's dark card background
- Candle up: semantic profit green
- Candle down: semantic loss red
- Minimum height: 300px

---

## Icons

Use `@tabler/icons-react` (included with Mantine).
Consistent size: `20` for inline, `24` for standalone.

---

## States

Every data-driven component must handle:
1. **Loading** — Mantine `Skeleton` components
2. **Empty** — Helpful message with suggestion (not blank space)
3. **Error** — Orange notification with retry option
4. **Populated** — Normal display

---

## Do / Don't

| Do | Don't |
|----|-------|
| Use Mantine theme tokens and components | Define custom hex colors for standard UI |
| Use monospace for all financial numbers | Use proportional fonts for prices/P&L |
| Right-align numbers in tables | Left-align numbers |
| Use green/red ONLY for P&L and win/loss | Use red for form errors or green for success toasts |
| Design empty states for every list/table | Leave blank screens when there's no data |
| Let Mantine handle dark theme consistency | Override Mantine's dark background colors |
| Use `fz="sm"` `verticalSpacing="xs"` for dense data views | Over-space trading data with large padding |