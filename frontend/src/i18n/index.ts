import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'

import en from './locales/en.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import it from './locales/it.json'
import de from './locales/de.json'
import pt from './locales/pt.json'

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  es: { translation: es },
  it: { translation: it },
  de: { translation: de },
  pt: { translation: pt },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'kiroku-language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already handles XSS escaping
    },
  })

export default i18n

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'it', 'de', 'pt'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

// Locale-aware date formatting. dayjs ships `en` built-in; the other locales
// load on demand so unused ones never reach the bundle.
dayjs.extend(localizedFormat)

const DAYJS_LOCALE_LOADERS: Record<
  Exclude<SupportedLanguage, 'en'>,
  () => Promise<unknown>
> = {
  fr: () => import('dayjs/locale/fr'),
  es: () => import('dayjs/locale/es'),
  it: () => import('dayjs/locale/it'),
  de: () => import('dayjs/locale/de'),
  pt: () => import('dayjs/locale/pt'),
}

/** Resolve a detected language (possibly region-tagged, e.g. `en-US`) to a base code. */
function baseLanguage(lang: string | undefined): SupportedLanguage {
  return SUPPORTED_LANGUAGES.find((code) => lang?.startsWith(code)) ?? 'en'
}

/** Load (lazily) and activate the dayjs locale matching the i18n language. */
async function syncDayjsLocale(lang: string): Promise<void> {
  const base = baseLanguage(lang)
  if (base !== 'en') {
    await DAYJS_LOCALE_LOADERS[base]()
  }
  if (dayjs.locale() !== base) {
    dayjs.locale(base)
    // The locale loads asynchronously, so components that already re-rendered
    // on the original `languageChanged` event still show the previous locale.
    // Re-emit now that the dayjs locale is active to refresh date formatting.
    i18n.emit('languageChanged', lang)
  }
}

i18n.on('languageChanged', syncDayjsLocale)
void syncDayjsLocale(i18n.language)
