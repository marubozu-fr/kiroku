import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
// Initialise i18next for the test environment so components using
// `useTranslation()` resolve keys (to their EN values) instead of rendering raw keys.
import '@/i18n'

// Several Mantine components (ScrollArea, Select) observe element size; jsdom
// does not implement ResizeObserver.
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
globalThis.ResizeObserver = ResizeObserverMock

// Mantine's Combobox (Select) scrolls the active option into view on open;
// jsdom does not implement Element.prototype.scrollIntoView.
Element.prototype.scrollIntoView = vi.fn()

// Mantine reads `window.matchMedia` on mount; jsdom does not implement it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})
