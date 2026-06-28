import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TagsTab } from '@/components/settings/TagsTab'
import type { Tag } from '@/types/referenceData'
import { jsonResponse, renderWithProviders } from '@/test/utils'

function tag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 1,
    name: 'Breakout',
    description: 'Price breaks a key level',
    is_active: true,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TagsTab', () => {
  it('lists tags returned by the API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([tag()])))

    renderWithProviders(<TagsTab />)

    expect(await screen.findByText('Breakout')).toBeInTheDocument()
    expect(screen.getByText('Price breaks a key level')).toBeInTheDocument()
  })

  describe('column filters', () => {
    const many = [
      tag({ id: 1, name: 'Breakout', description: 'Price breaks a key level' }),
      tag({ id: 2, name: 'Reversal', description: 'Trend changes direction' }),
    ]

    it('renders the name and description filter inputs', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(many)))
      renderWithProviders(<TagsTab />)
      await screen.findByText('Breakout')

      expect(screen.getByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
    })

    it('filters by name (case-insensitive substring)', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(many)))
      renderWithProviders(<TagsTab />)
      await screen.findByText('Breakout')

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'rever' } })

      await waitFor(() => expect(screen.queryByText('Breakout')).not.toBeInTheDocument())
      expect(screen.getByText('Reversal')).toBeInTheDocument()
      expect(screen.getByText('Showing 1 of 2 tags')).toBeInTheDocument()
    })

    it('filters by description', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(many)))
      renderWithProviders(<TagsTab />)
      await screen.findByText('Breakout')

      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'key level' } })

      await waitFor(() => expect(screen.queryByText('Reversal')).not.toBeInTheDocument())
      expect(screen.getByText('Breakout')).toBeInTheDocument()
    })
  })

  it('shows the empty state when there are no tags', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])))

    renderWithProviders(<TagsTab />)

    expect(await screen.findByText(/no tags yet/i)).toBeInTheDocument()
  })

  it('deactivates an active tag via a PUT toggle (not DELETE)', async () => {
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return jsonResponse(tag({ is_active: false }))
      return jsonResponse([tag()])
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<TagsTab />)
    const toggle = await screen.findByLabelText('Deactivate Breakout')

    fireEvent.click(toggle)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tags/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ is_active: false }),
        }),
      ),
    )

    // Must NOT have issued a DELETE request.
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.method !== 'DELETE'),
    ).toBe(true)
  })

  describe('cascade delete — trade_count == 0', () => {
    it('shows simple copy, Delete button, and issues DELETE /api/tags/{id}', async () => {
      const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
        if (input.endsWith('/trade-count')) return jsonResponse({ trade_count: 0 })
        if (init?.method === 'DELETE') return jsonResponse(null, { status: 204 })
        return jsonResponse([tag()])
      })
      vi.stubGlobal('fetch', fetchMock)

      renderWithProviders(<TagsTab />)
      await screen.findByText('Breakout')

      // Arrange: open the delete modal.
      fireEvent.click(screen.getByLabelText('Delete Breakout'))

      const dialog = await screen.findByRole('dialog')

      // Assert: simple copy shown (no warning alert).
      expect(
        await within(dialog).findByText('Delete Breakout? This action cannot be undone.'),
      ).toBeInTheDocument()
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()

      // Assert: Delete button present.
      const deleteBtn = within(dialog).getByRole('button', { name: 'Delete' })
      expect(deleteBtn).toBeInTheDocument()

      // Act: click Delete.
      fetchMock.mockClear()
      fireEvent.click(deleteBtn)

      // Assert: DELETE /api/tags/1 was issued.
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/tags/1',
          expect.objectContaining({ method: 'DELETE' }),
        ),
      )

      // Assert: modal closes after deletion.
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  describe('cascade delete — trade_count > 0', () => {
    it('shows warning copy with trade count, keeps Delete button, issues DELETE /api/tags/{id}', async () => {
      const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
        if (input.endsWith('/trade-count')) return jsonResponse({ trade_count: 5 })
        if (init?.method === 'DELETE') return jsonResponse(null, { status: 204 })
        return jsonResponse([tag()])
      })
      vi.stubGlobal('fetch', fetchMock)

      renderWithProviders(<TagsTab />)
      await screen.findByText('Breakout')

      fireEvent.click(screen.getByLabelText('Delete Breakout'))

      const dialog = await screen.findByRole('dialog')

      // Assert: question line present.
      expect(await within(dialog).findByText('Delete Breakout?')).toBeInTheDocument()

      // Assert: orange warning alert with trade count.
      expect(
        within(dialog).getByText(
          'This tag is associated with 5 trades. It will be removed from those trades.',
        ),
      ).toBeInTheDocument()

      // Assert: "cannot be undone" line present.
      expect(within(dialog).getByText('This action cannot be undone.')).toBeInTheDocument()

      // Assert: Delete button is still present (cascade mode — not blocked).
      const deleteBtn = within(dialog).getByRole('button', { name: 'Delete' })
      expect(deleteBtn).toBeInTheDocument()

      // Act: click Delete.
      fetchMock.mockClear()
      fireEvent.click(deleteBtn)

      // Assert: DELETE /api/tags/1 was issued.
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/tags/1',
          expect.objectContaining({ method: 'DELETE' }),
        ),
      )

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })
})
