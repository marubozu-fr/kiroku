import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '@/pages/SettingsPage'
import type { Preferences } from '@/types/preferences'
import { jsonResponse, renderWithProviders } from '@/test/utils'

function preferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    risk_per_trade_default: 1,
    news_enabled: true,
    news_currencies: ['USD'],
    news_min_impact: 'MEDIUM',
    backup_directory: null,
    backup_reminder_days: 7,
    last_backup_at: null,
    massive_api_key: '',
    chart_timeframes_default: [],
    entry_timeframe_unit_default: null,
    entry_timeframe_value_default: null,
    chart_timeframes_warning_threshold: 8,
    ...overrides,
  }
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        if (input === '/api/preferences' && method === 'GET') {
          return jsonResponse(preferences())
        }
        if (input === '/api/preferences' && method === 'PATCH') {
          return jsonResponse(preferences())
        }
        return jsonResponse([])
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the settings heading', async () => {
    renderWithProviders(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('renders Platform and Charts tabs', async () => {
    renderWithProviders(<SettingsPage />)

    expect(screen.getByRole('tab', { name: 'Platform' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Charts' })).toBeInTheDocument()
  })

  it('shows the Platform tab content by default (language selector visible)', async () => {
    renderWithProviders(<SettingsPage />)

    expect(
      await screen.findByRole('textbox', {
        description: 'Choose the display language',
      }),
    ).toBeInTheDocument()
  })

  it('shows the Charts tab content after switching (API key field visible)', async () => {
    renderWithProviders(<SettingsPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Charts' }))

    expect(await screen.findByLabelText('Massive API Key')).toBeInTheDocument()
  })

  it('does not render entity-management tabs (moved to Manage page)', () => {
    renderWithProviders(<SettingsPage />)

    // The entity-management tabs have moved to the Manage page.
    expect(screen.queryByRole('tab', { name: 'Assets' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Tags' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Emotions' })).not.toBeInTheDocument()
  })
})
