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

  it('renders the settings heading and all three tabs', async () => {
    renderWithProviders(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Assets' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tags' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Emotions' })).toBeInTheDocument()

    // The default (Assets) tab loads and shows its empty state.
    expect(await screen.findByText(/no assets yet/i)).toBeInTheDocument()
  })

  it('switches to the Emotions tab and loads grouped data', async () => {
    renderWithProviders(<SettingsPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Emotions' }))

    expect(await screen.findByText(/no emotions yet/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/emotions/grouped',
        expect.anything(),
      )
    })
  })
})
