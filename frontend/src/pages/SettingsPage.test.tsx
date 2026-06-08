import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsPage } from '@/pages/SettingsPage'

describe('SettingsPage', () => {
  it('renders the settings heading', () => {
    render(
      <MantineProvider>
        <SettingsPage />
      </MantineProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })
})
