import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { PlatformTab } from '@/components/settings/PlatformTab'
import type { Preferences } from '@/types/preferences'
import type { BackupResult } from '@/types/backup'
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

const backupResult: BackupResult = {
  filename: 'kiroku-backup-2026-06-22T14-30-00.zip',
  path: '/backups/kiroku-backup-2026-06-22T14-30-00.zip',
  created_at: '2026-06-22T14:30:00+00:00',
  trades_count: 12,
  screenshots_count: 4,
}

function stubFetch(
  handlers: {
    prefs?: Preferences
    patchStatus?: { ok: boolean; status: number; error: string | null }
    onPatch?: (body: unknown) => void
  } = {},
) {
  const { prefs = preferences(), patchStatus, onPatch } = handlers
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url === '/api/preferences' && method === 'GET') {
      return jsonResponse(prefs)
    }
    if (url === '/api/preferences' && method === 'PATCH') {
      onPatch?.(JSON.parse(init?.body as string))
      if (patchStatus) {
        return jsonResponse(null, patchStatus)
      }
      return jsonResponse(prefs)
    }
    if (url === '/api/backup' && method === 'POST') {
      return jsonResponse(backupResult)
    }
    throw new Error(`Unexpected request: ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('PlatformTab', () => {
  it('renders the language selector pre-set to the current language', async () => {
    stubFetch()
    renderWithProviders(<PlatformTab />)

    const input = screen.getByRole('textbox', {
      description: 'Choose the display language',
    })
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('English')
  })

  it('renders the theme selector pre-set to the current color scheme', async () => {
    stubFetch()
    renderWithProviders(<PlatformTab />)

    // Query by label since theme_description is "Also available from the header toggle."
    const input = screen.getByRole('textbox', { name: 'Theme' })
    expect(input).toBeInTheDocument()
    // MantineProvider defaults to the light color scheme in tests.
    expect(input).toHaveValue('Light')
  })

  it('switches the color scheme when a different option is picked', async () => {
    stubFetch()
    renderWithProviders(<PlatformTab />)

    const input = screen.getByRole('textbox', { name: 'Theme' })
    fireEvent.click(input)
    fireEvent.click(await screen.findByText('Dark'))

    await waitFor(() => expect(input).toHaveValue('Dark'))
  })

  it('renders the backup directory input empty when none is configured', async () => {
    stubFetch()
    renderWithProviders(<PlatformTab />)

    const input = await screen.findByRole('textbox', { name: 'Backup directory' })
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('renders the restore section title', async () => {
    stubFetch()
    renderWithProviders(<PlatformTab />)

    expect(await screen.findByText('Restore from backup')).toBeInTheDocument()
  })
})
