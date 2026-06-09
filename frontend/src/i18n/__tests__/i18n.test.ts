import { describe, expect, it } from 'vitest'
import i18n, { SUPPORTED_LANGUAGES } from '@/i18n'

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import es from '@/i18n/locales/es.json'
import itLocale from '@/i18n/locales/it.json'
import de from '@/i18n/locales/de.json'
import pt from '@/i18n/locales/pt.json'

describe('i18n', () => {
  it('initializes without errors', () => {
    expect(i18n.isInitialized).toBe(true)
  })

  it('defaults to English', () => {
    // `resolvedLanguage` is the language actually used for lookups: region
    // variants (e.g. en-US from navigator) resolve to the base 'en'.
    expect(i18n.resolvedLanguage).toBe('en')
  })

  it('resolves a known translation key', () => {
    expect(i18n.t('common.actions.save')).toBe('Save')
  })

  it('exposes exactly the six supported languages', () => {
    expect([...SUPPORTED_LANGUAGES]).toEqual(['en', 'fr', 'es', 'it', 'de', 'pt'])
  })

  it('keeps an identical key structure across all locale files', () => {
    // Collect every nested key path (e.g. "common.actions.save"), sorted.
    const keyPaths = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key
        return value !== null && typeof value === 'object'
          ? keyPaths(value as Record<string, unknown>, path)
          : [path]
      })

    const locales = { en, fr, es, it: itLocale, de, pt }
    const reference = JSON.stringify(keyPaths(en).sort())

    for (const [lang, content] of Object.entries(locales)) {
      expect(JSON.stringify(keyPaths(content).sort()), lang).toBe(reference)
    }
  })
})
