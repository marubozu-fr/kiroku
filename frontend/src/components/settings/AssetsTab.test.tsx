import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssetsTab } from '@/components/settings/AssetsTab'
import type { Asset } from '@/types/referenceData'
import { jsonResponse, renderWithProviders } from '@/test/utils'

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 1,
    name: 'EUR/USD',
    category: 'Forex',
    currency: 'USD',
    is_active: true,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AssetsTab', () => {
  it('lists assets returned by the API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([asset()])))

    renderWithProviders(<AssetsTab />)

    expect(await screen.findByText('EUR/USD')).toBeInTheDocument()
    expect(screen.getByText('Forex')).toBeInTheDocument()
  })

  it('shows the empty state when there are no assets', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])))

    renderWithProviders(<AssetsTab />)

    expect(await screen.findByText(/no assets yet/i)).toBeInTheDocument()
  })

  it('shows an error state with retry on load failure', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(null, { ok: false, status: 500, error: 'Server exploded' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<AssetsTab />)

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()

    // Retry triggers another request.
    fetchMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })

  it('opens the add modal with an empty form', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])))

    renderWithProviders(<AssetsTab />)
    await screen.findByText(/no assets yet/i)

    fireEvent.click(screen.getByRole('button', { name: /add asset/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Add asset')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/name/i)).toHaveValue('')
  })

  it('shows a non-blocking hint when the name contains a slash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])))

    renderWithProviders(<AssetsTab />)
    await screen.findByText(/no assets yet/i)

    fireEvent.click(screen.getByRole('button', { name: /add asset/i }))
    const dialog = await screen.findByRole('dialog')

    const nameInput = within(dialog).getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: 'EUR/USD' } })

    expect(await within(dialog).findByText(/use the currency field/i)).toBeInTheDocument()

    // Hint clears once the slash is removed.
    fireEvent.change(nameInput, { target: { value: 'EUR' } })
    await waitFor(() =>
      expect(within(dialog).queryByText(/use the currency field/i)).not.toBeInTheDocument(),
    )
  })

  it('deactivates an active asset via the toggle', async () => {
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return jsonResponse(asset({ is_active: false }))
      }
      return jsonResponse([asset()])
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<AssetsTab />)
    const toggle = await screen.findByLabelText('Deactivate EUR/USD')

    fireEvent.click(toggle)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/assets/1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
  })
})
