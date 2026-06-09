import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { GeneralTab } from '@/components/settings/GeneralTab'
import { renderWithProviders } from '@/test/utils'

describe('GeneralTab', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders the language selector pre-set to the current language', () => {
    renderWithProviders(<GeneralTab />)

    const input = screen.getByRole('textbox', { name: 'Language' })
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('English')
  })

  it('switches the UI language when a different option is picked', async () => {
    renderWithProviders(<GeneralTab />)

    fireEvent.click(screen.getByRole('textbox', { name: 'Language' }))
    fireEvent.click(await screen.findByText('Français'))

    await waitFor(() => {
      expect(i18n.language).toBe('fr')
    })
    // The label itself re-renders in the newly selected language.
    expect(screen.getByRole('textbox', { name: 'Langue' })).toBeInTheDocument()
  })
})
