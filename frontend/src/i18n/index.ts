import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

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
