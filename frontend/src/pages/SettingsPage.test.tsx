import { screen } from '@testing-library/react'
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

  it('renders the settings heading and the General tab content', async () => {
    renderWithProviders(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()

    // The General tab loads and shows the language selector.
    expect(
      await screen.findByRole('textbox', {
        description: 'Choose the display language',
      }),
    ).toBeInTheDocument()

    // The entity-management tabs have moved to the Manage page.
    expect(screen.queryByRole('tab', { name: 'Assets' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Tags' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Emotions' }),
    ).not.toBeInTheDocument()
  })
})
