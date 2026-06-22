import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '@/pages/SettingsPage'
import { jsonResponse, renderWithProviders } from '@/test/utils'

describe('SettingsPage', () => {
  beforeEach(() => {
    // Default: every endpoint returns an empty collection.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (input.includes('/emotions/grouped')) {
          return jsonResponse({})
        }
        return jsonResponse([])
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the settings heading and all four tabs', async () => {
    renderWithProviders(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Assets' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tags' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Emotions' })).toBeInTheDocument()

    // The default (General) tab loads and shows the language selector.
    expect(
      await screen.findByRole('textbox', {
        description: 'Choose the display language',
      }),
    ).toBeInTheDocument()
  })

  it('switches to the Emotions tab and loads grouped data', async () => {
    renderWithProviders(<SettingsPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Emotions' }))

    // With no emotions, the tab shows the onboarding (replacing the plain
    // empty state).
    expect(
      await screen.findByText('Get started with curated trading emotions'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/emotions/grouped',
        expect.anything(),
      )
    })
  })
})
