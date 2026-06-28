import { fireEvent, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { BackupReminderBanner } from '@/components/BackupReminderBanner'
import type { Preferences } from '@/types/preferences'
import type { BackupResult } from '@/types/backup'
import { jsonResponse, renderWithProviders } from '@/test/utils'

const DISMISS_KEY = 'backup_reminder_dismissed_until'

// jsdom in this project does not expose a functional localStorage, so back it
// with a simple in-memory store for the banner's dismissal logic.
function localStorageMock(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
}

function preferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    risk_per_trade_default: 1,
    news_enabled: true,
    news_currencies: ['USD'],
    news_min_impact: 'MEDIUM',
    backup_directory: '/backups',
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
  filename: 'kiroku-backup.zip',
  path: '/backups/kiroku-backup.zip',
  created_at: '2026-06-22T14:30:00+00:00',
  trades_count: 1,
  screenshots_count: 0,
}

function stubFetch(prefs: Preferences) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url === '/api/preferences' && method === 'GET') {
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

/** Render and flush the preferences fetch so visibility settles. */
async function renderSettled() {
  renderWithProviders(<BackupReminderBanner />)
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock())
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('en')
})

describe('BackupReminderBanner', () => {
  it('does not render when no backup directory is configured', async () => {
    stubFetch(preferences({ backup_directory: null }))
    await renderSettled()

    expect(screen.queryByRole('button', { name: 'Back up now' })).not.toBeInTheDocument()
  })

  it('does not render when reminders are disabled', async () => {
    stubFetch(preferences({ backup_reminder_days: 0 }))
    await renderSettled()

    expect(screen.queryByRole('button', { name: 'Back up now' })).not.toBeInTheDocument()
  })

  it('does not render when the last backup is still recent', async () => {
    stubFetch(preferences({ last_backup_at: new Date().toISOString() }))
    await renderSettled()

    expect(screen.queryByRole('button', { name: 'Back up now' })).not.toBeInTheDocument()
  })

  it('renders the "never backed up" message when there is no backup', async () => {
    stubFetch(preferences({ last_backup_at: null }))
    renderWithProviders(<BackupReminderBanner />)

    expect(
      await screen.findByText("You haven't backed up your data yet"),
    ).toBeInTheDocument()
  })

  it('renders an "X days ago" message when the backup is overdue', async () => {
    stubFetch(preferences({ last_backup_at: '2000-01-01T00:00:00+00:00' }))
    renderWithProviders(<BackupReminderBanner />)

    expect(
      await screen.findByText(/Your last backup was \d+ days ago/),
    ).toBeInTheDocument()
  })

  it('does not render when a dismissal is still active', async () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 100_000))
    stubFetch(preferences({ last_backup_at: null }))
    await renderSettled()

    expect(screen.queryByRole('button', { name: 'Back up now' })).not.toBeInTheDocument()
  })

  it('runs a backup and hides the banner on success', async () => {
    const fetchMock = stubFetch(preferences({ last_backup_at: null }))
    renderWithProviders(<BackupReminderBanner />)

    const button = await screen.findByRole('button', { name: 'Back up now' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/backup',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    await waitFor(() => {
      expect(
        screen.queryByText("You haven't backed up your data yet"),
      ).not.toBeInTheDocument()
    })
  })

  it('dismisses for 24 hours via "Not now"', async () => {
    stubFetch(preferences({ last_backup_at: null }))
    renderWithProviders(<BackupReminderBanner />)

    await screen.findByText("You haven't backed up your data yet")
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    await waitFor(() => {
      expect(
        screen.queryByText("You haven't backed up your data yet"),
      ).not.toBeInTheDocument()
    })
    expect(Number(localStorage.getItem(DISMISS_KEY))).toBeGreaterThan(Date.now())
  })
})
