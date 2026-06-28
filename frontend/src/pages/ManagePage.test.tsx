import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManagePage } from '@/pages/ManagePage'
import { jsonResponse, renderWithProviders } from '@/test/utils'

describe('ManagePage', () => {
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

  it('renders the heading and all four tabs', () => {
    renderWithProviders(<ManagePage />)

    expect(screen.getByRole('heading', { name: 'Manage' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Assets' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tags' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Emotions' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'News' })).toBeInTheDocument()
  })

  it('defaults to the Assets tab', () => {
    renderWithProviders(<ManagePage />)

    expect(screen.getByRole('tab', { name: 'Assets' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('switches to the Emotions tab and loads grouped data', async () => {
    renderWithProviders(<ManagePage />)

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
