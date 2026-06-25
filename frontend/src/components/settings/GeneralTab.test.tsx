import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifications } from '@mantine/notifications'
import i18n from '@/i18n'
import { GeneralTab } from '@/components/settings/GeneralTab'
import type { Preferences } from '@/types/preferences'
import type { BackupResult } from '@/types/backup'
import type { TickerSearchResult } from '@/types/massive'
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
    tickers?: TickerSearchResult[]
  } = {},
) {
  const { prefs = preferences(), patchStatus, onPatch, tickers = [] } = handlers
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
    if ((url as string).startsWith('/api/massive/tickers') && method === 'GET') {
      return jsonResponse(tickers)
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

describe('GeneralTab', () => {
  it('renders the language selector pre-set to the current language', async () => {
    stubFetch()
    renderWithProviders(<GeneralTab />)

    const input = screen.getByRole('textbox', {
      description: 'Choose the display language',
    })
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('English')
  })

  it('switches the UI language when a different option is picked', async () => {
    stubFetch()
    renderWithProviders(<GeneralTab />)

    fireEvent.click(
      screen.getByRole('textbox', { description: 'Choose the display language' }),
    )
    fireEvent.click(await screen.findByText('Français'))

    await waitFor(() => {
      expect(i18n.language).toBe('fr')
    })
    expect(
      screen.getByRole('textbox', { description: "Choisissez la langue d'affichage" }),
    ).toBeInTheDocument()
  })

  it('renders the backup directory input empty when none is configured', async () => {
    stubFetch()
    renderWithProviders(<GeneralTab />)

    const input = await screen.findByRole('textbox', { name: 'Backup directory' })
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('saves the backup directory via PATCH', async () => {
    const onPatch = vi.fn()
    stubFetch({ onPatch })
    renderWithProviders(<GeneralTab />)

    const input = await screen.findByRole('textbox', { name: 'Backup directory' })
    fireEvent.change(input, { target: { value: '/backups' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save path' }))

    await waitFor(() => {
      expect(onPatch).toHaveBeenCalledWith({ backup_directory: '/backups' })
    })
  })

  it('shows an inline error when the backup directory is rejected (400)', async () => {
    stubFetch({ patchStatus: { ok: false, status: 400, error: 'invalid path' } })
    renderWithProviders(<GeneralTab />)

    const input = await screen.findByRole('textbox', { name: 'Backup directory' })
    fireEvent.change(input, { target: { value: '/nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save path' }))

    expect(
      await screen.findByText("This path doesn't exist or isn't writable."),
    ).toBeInTheDocument()
  })

  it('renders the reminder frequency select with the persisted value', async () => {
    stubFetch({ prefs: preferences({ backup_reminder_days: 30 }) })
    renderWithProviders(<GeneralTab />)

    const select = await screen.findByRole('textbox', { name: 'Backup reminder' })
    await waitFor(() => expect(select).toHaveValue('Every 30 days'))
  })

  it('auto-saves a reminder frequency change via PATCH', async () => {
    const onPatch = vi.fn()
    stubFetch({ onPatch })
    renderWithProviders(<GeneralTab />)

    const select = await screen.findByRole('textbox', { name: 'Backup reminder' })
    await waitFor(() => expect(select).toHaveValue('Every 7 days'))
    fireEvent.click(select)
    fireEvent.click(await screen.findByText('Every 30 days'))

    await waitFor(() => {
      expect(onPatch).toHaveBeenCalledWith({ backup_reminder_days: 30 })
    })
  })

  it('shows "Never" when there is no last backup', async () => {
    stubFetch()
    renderWithProviders(<GeneralTab />)

    expect(await screen.findByText('Last backup: Never')).toBeInTheDocument()
  })

  it('shows a formatted date when a last backup exists', async () => {
    stubFetch({ prefs: preferences({ last_backup_at: '2026-06-20T12:00:00+00:00' }) })
    renderWithProviders(<GeneralTab />)

    await waitFor(() => {
      expect(screen.queryByText('Last backup: Never')).not.toBeInTheDocument()
      expect(screen.getByText(/^Last backup: \w/)).toBeInTheDocument()
    })
  })

  it('disables the backup button when no directory is configured', async () => {
    stubFetch()
    renderWithProviders(<GeneralTab />)

    const button = await screen.findByRole('button', { name: 'Back up now' })
    await waitFor(() => expect(button).toBeDisabled())
  })

  it('runs a backup and notifies on success', async () => {
    const showSpy = vi.spyOn(notifications, 'show')
    const fetchMock = stubFetch({ prefs: preferences({ backup_directory: '/backups' }) })
    renderWithProviders(<GeneralTab />)

    const button = await screen.findByRole('button', { name: 'Back up now' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/backup',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    await waitFor(() => {
      expect(showSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Backup saved: ${backupResult.filename}`,
        }),
      )
    })
  })

  describe('Massive API key', () => {
    it('seeds the API key PasswordInput from stored preferences', async () => {
      stubFetch({ prefs: preferences({ massive_api_key: 'abc123' }) })
      renderWithProviders(<GeneralTab />)

      const input = await screen.findByLabelText('Massive API Key')
      await waitFor(() => expect(input).toHaveValue('abc123'))
    })

    it('saves a non-empty key, validates it, and notifies success when tickers are returned', async () => {
      const showSpy = vi.spyOn(notifications, 'show')
      const onPatch = vi.fn()
      const fetchMock = stubFetch({
        prefs: preferences({ massive_api_key: '' }),
        onPatch,
        tickers: [{ ticker: 'C:EURUSD', name: 'EUR/USD', market: 'fx', active: true }],
      })
      renderWithProviders(<GeneralTab />)

      const input = await screen.findByLabelText('Massive API Key')
      fireEvent.change(input, { target: { value: 'abc123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(onPatch).toHaveBeenCalledWith({ massive_api_key: 'abc123' })
      })
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/massive/tickers'),
          expect.objectContaining({ method: 'GET' }),
        )
      })
      await waitFor(() => {
        expect(showSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'API key verified — market data is enabled',
          }),
        )
      })
    })

    it('shows a warning when the tickers endpoint returns an empty array', async () => {
      const showSpy = vi.spyOn(notifications, 'show')
      const onPatch = vi.fn()
      stubFetch({
        prefs: preferences({ massive_api_key: '' }),
        onPatch,
        tickers: [],
      })
      renderWithProviders(<GeneralTab />)

      const input = await screen.findByLabelText('Massive API Key')
      fireEvent.change(input, { target: { value: 'bad-key' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(onPatch).toHaveBeenCalledWith({ massive_api_key: 'bad-key' })
      })
      await waitFor(() => {
        expect(showSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Could not verify the API key — check it and try again',
          }),
        )
      })
    })

    it('clears the key, patches with empty string, and skips ticker validation', async () => {
      const onPatch = vi.fn()
      const fetchMock = stubFetch({
        prefs: preferences({ massive_api_key: 'abc123' }),
        onPatch,
      })
      renderWithProviders(<GeneralTab />)

      const input = await screen.findByLabelText('Massive API Key')
      await waitFor(() => expect(input).toHaveValue('abc123'))

      fireEvent.change(input, { target: { value: '' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(onPatch).toHaveBeenCalledWith({ massive_api_key: '' })
      })
      // The tickers validation endpoint must NOT be called when the key is cleared.
      expect(
        fetchMock.mock.calls.every(([url]) => !String(url).startsWith('/api/massive/tickers')),
      ).toBe(true)
    })
  })
})
