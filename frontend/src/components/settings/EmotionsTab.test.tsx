import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmotionsTab } from '@/components/settings/EmotionsTab'
import { EMOTION_PRESETS } from '@/data/emotionPresets'
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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('EmotionsTab', () => {
  it('lists emotions in a flat table with Category and Severity columns', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([emotion()])))

    renderWithProviders(<EmotionsTab />)

    expect(await screen.findByText('FOMO')).toBeInTheDocument()
    expect(screen.getByText('Fear of missing out')).toBeInTheDocument()
    // Category and severity render as cell badges (the same text also exists as
    // hidden filter-select options, so scope to the row cells).
    expect(screen.getByRole('cell', { name: 'Emotional State' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Bad' })).toBeInTheDocument()
  })

  describe('filters', () => {
    function multi(): Emotion[] {
      return [
        emotion({ id: 1, name: 'FOMO', severity: 'Bad', category: 'Emotional State' }),
        emotion({
          id: 2,
          name: 'Calm',
          severity: 'Good',
          category: 'Focus & Clarity',
          description: 'Steady and composed',
        }),
      ]
    }

    it('narrows the list by category', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(multi())))
      renderWithProviders(<EmotionsTab />)
      await screen.findByText('FOMO')
      expect(screen.getByText('Calm')).toBeInTheDocument()

      // Mantine Select is a combobox; open the visible input (scoped past the
      // hidden value input) and pick the option by role.
      fireEvent.click(screen.getByLabelText('Category', { selector: '.mantine-Select-input' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Focus & Clarity' }))

      await waitFor(() => expect(screen.queryByText('FOMO')).not.toBeInTheDocument())
      expect(screen.getByText('Calm')).toBeInTheDocument()
    })

    it('narrows the list by severity', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(multi())))
      renderWithProviders(<EmotionsTab />)
      await screen.findByText('FOMO')

      fireEvent.click(screen.getByLabelText('Severity', { selector: '.mantine-Select-input' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Good' }))

      await waitFor(() => expect(screen.queryByText('FOMO')).not.toBeInTheDocument())
      expect(screen.getByText('Calm')).toBeInTheDocument()
    })
  })

  describe('onboarding (no emotions)', () => {
    it('shows the onboarding instead of the plain empty state when there are no emotions', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])))

      renderWithProviders(<EmotionsTab />)

      expect(
        await screen.findByText('Get started with curated trading emotions'),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Import emotions' }),
      ).toBeInTheDocument()
      // The "+ New emotion" button is suppressed during onboarding.
      expect(
        screen.queryByRole('button', { name: 'Add emotion' }),
      ).not.toBeInTheDocument()
      // The plain empty-state copy is replaced by the onboarding.
      expect(screen.queryByText(/no emotions yet/i)).not.toBeInTheDocument()
    })

    it('"Or start from scratch" reveals the standard empty state and the add button', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])))

      renderWithProviders(<EmotionsTab />)
      await screen.findByText('Get started with curated trading emotions')

      fireEvent.click(screen.getByRole('button', { name: 'Or start from scratch' }))

      expect(await screen.findByText(/no emotions yet/i)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Add emotion' }),
      ).toBeInTheDocument()
    })

    it('imports the curated set, posts to /api/emotions/bulk, and refreshes the list', async () => {
      let imported = false
      const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
        if (input.endsWith('/emotions/bulk') && init?.method === 'POST') {
          imported = true
          return jsonResponse([emotion()])
        }
        return jsonResponse(imported ? [emotion()] : [])
      })
      vi.stubGlobal('fetch', fetchMock)
      const showSpy = vi.spyOn(notifications, 'show')

      renderWithProviders(<EmotionsTab />)
      await screen.findByText('Get started with curated trading emotions')

      fireEvent.click(screen.getByRole('button', { name: 'Import emotions' }))

      // Assert: the bulk endpoint received all 42 English presets.
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/emotions/bulk',
          expect.objectContaining({ method: 'POST' }),
        ),
      )
      const bulkCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/emotions/bulk'))
      const body = JSON.parse((bulkCall?.[1] as RequestInit).body as string)
      expect(body.emotions).toHaveLength(EMOTION_PRESETS.en.length)

      // Assert: the list refreshes and the imported emotion renders.
      expect(await screen.findByText('FOMO')).toBeInTheDocument()
      expect(showSpy).toHaveBeenCalled()
    })

    it('shows an error notification when the import fails', async () => {
      const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
        if (input.endsWith('/emotions/bulk') && init?.method === 'POST') {
          return jsonResponse(null, { ok: false, status: 500, error: 'boom' })
        }
        return jsonResponse([])
      })
      vi.stubGlobal('fetch', fetchMock)
      const showSpy = vi.spyOn(notifications, 'show')

      renderWithProviders(<EmotionsTab />)
      await screen.findByText('Get started with curated trading emotions')

      fireEvent.click(screen.getByRole('button', { name: 'Import emotions' }))

      await waitFor(() =>
        expect(showSpy).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Failed to import emotions' }),
        ),
      )
      // Onboarding stays visible after a failed import.
      expect(
        screen.getByText('Get started with curated trading emotions'),
      ).toBeInTheDocument()
    })
  })

  describe('cascade delete — trade_count == 0', () => {
    it('shows simple copy, Delete button, and issues DELETE /api/emotions/{id}', async () => {
      const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
        if (input.endsWith('/trade-count')) return jsonResponse({ trade_count: 0 })
        if (init?.method === 'DELETE') return jsonResponse(null, { status: 204 })
        return jsonResponse([emotion()])
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
        return jsonResponse([emotion()])
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
