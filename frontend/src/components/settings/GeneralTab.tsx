import { Select, Stack } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES } from '@/i18n'

export function GeneralTab() {
  const { t, i18n } = useTranslation()

  // i18n.language may carry a region (e.g. "en-US" from the browser detector),
  // so match the Select value against the supported base codes.
  const current =
    SUPPORTED_LANGUAGES.find((lang) => i18n.language?.startsWith(lang)) ?? 'en'

  const handleChange = (value: string | null) => {
    if (value) {
      i18n.changeLanguage(value)
    }
  }

  return (
    <Stack gap="md" maw={320}>
      <Select
        label={t('settings.general.language_label')}
        description={t('settings.general.language_description')}
        data={LANGUAGE_OPTIONS}
        value={current}
        onChange={handleChange}
        allowDeselect={false}
      />
    </Stack>
  )
}
