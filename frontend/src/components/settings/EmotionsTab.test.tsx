import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmotionsTab } from '@/components/settings/EmotionsTab'
import type { Emotion } from '@/types/referenceData'
import { jsonResponse, renderWithProviders } from '@/test/utils'

function emotion(overrides: Partial<Emotion> = {}): Emotion {
  return {
    id: 1,
    name: 'FOMO',
    description: 'Fear of missing out',
    severity: 'Bad',
    category: 'Emotional State',
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

/** Wrap a single emotion in the grouped-endpoint shape. */
function grouped(e: Emotion): Record<string, Emotion[]> {
  return { [e.category]: [e] }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EmotionsTab', () => {
  it('lists emotions returned by the grouped API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(grouped(emotion()))))

    renderWithProviders(<EmotionsTab />)

    expect(await screen.findByText('FOMO')).toBeInTheDocument()
    expect(screen.getByText('Fear of missing out')).toBeInTheDocument()
    expect(screen.getByText('Emotional State')).toBeInTheDocument()
  })

  it('shows the empty state when there are no emotions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})))

    renderWithProviders(<EmotionsTab />)

    expect(await screen.findByText(/no emotions yet/i)).toBeInTheDocument()
  })

  describe('cascade delete — trade_count == 0', () => {
    it('shows simple copy, Delete button, and issues DELETE /api/emotions/{id}', async () => {
      const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
        if (input.endsWith('/trade-count')) return jsonResponse({ trade_count: 0 })
        if (init?.method === 'DELETE') return jsonResponse(null, { status: 204 })
        return jsonResponse(grouped(emotion()))
      })
      vi.stubGlobal('fetch', fetchMock)

      renderWithProviders(<EmotionsTab />)
      await screen.findByText('FOMO')

      // Arrange: open the delete modal.
      fireEvent.click(screen.getByLabelText('Delete FOMO'))

      const dialog = await screen.findByRole('dialog')

      // Assert: simple copy shown (no warning alert).
      expect(
        await within(dialog).findByText('Delete FOMO? This action cannot be undone.'),
      ).toBeInTheDocument()
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()

      // Assert: Delete button present.
      const deleteBtn = within(dialog).getByRole('button', { name: 'Delete' })
      expect(deleteBtn).toBeInTheDocument()

      // Act: click Delete.
      fetchMock.mockClear()
      fireEvent.click(deleteBtn)

      // Assert: DELETE /api/emotions/1 was issued.
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/emotions/1',
          expect.objectContaining({ method: 'DELETE' }),
        ),
      )

      // Assert: modal closes after deletion.
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  describe('cascade delete — trade_count > 0', () => {
    it('shows warning copy with trade count, keeps Delete button, issues DELETE /api/emotions/{id}', async () => {
      const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
        if (input.endsWith('/trade-count')) return jsonResponse({ trade_count: 2 })
        if (init?.method === 'DELETE') return jsonResponse(null, { status: 204 })
        return jsonResponse(grouped(emotion()))
      })
      vi.stubGlobal('fetch', fetchMock)

      renderWithProviders(<EmotionsTab />)
      await screen.findByText('FOMO')

      fireEvent.click(screen.getByLabelText('Delete FOMO'))

      const dialog = await screen.findByRole('dialog')

      // Assert: question line present.
      expect(await within(dialog).findByText('Delete FOMO?')).toBeInTheDocument()

      // Assert: orange warning alert with trade count.
      expect(
        within(dialog).getByText(
          'This emotion is associated with 2 trades. It will be removed from those trades.',
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

      // Assert: DELETE /api/emotions/1 was issued.
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/emotions/1',
          expect.objectContaining({ method: 'DELETE' }),
        ),
      )

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })
})
