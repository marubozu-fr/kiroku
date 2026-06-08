import { createTheme } from '@mantine/core'

/**
 * Kiroku Mantine theme.
 *
 * Per docs/DESIGN_SYSTEM.md we lean on Mantine's built-in dark theme for all
 * standard UI. The only project-specific override here is the monospace font,
 * used for every financial number (prices, P&L, percentages, R values).
 *
 * Semantic profit/loss colours map directly to Mantine's `green.6` / `red.6`,
 * which require no theme override.
 */
export const theme = createTheme({
  fontFamilyMonospace: 'JetBrains Mono, SF Mono, Consolas, monospace',
})
