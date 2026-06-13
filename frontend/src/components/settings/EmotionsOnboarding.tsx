import { useState } from 'react'
import { IconMoodSmile } from '@tabler/icons-react'
import { Anchor, Button, Select, Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { EMOTION_PRESETS } from '@/data/emotionPresets'
import { LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES } from '@/i18n'
import type { SupportedLanguage } from '@/i18n'
import { emotionsApi } from '@/services/referenceData'
import { notifyError, notifySuccess } from './notify'

interface EmotionsOnboardingProps {
  /** Called after a successful bulk import so the parent can refresh its list. */
  onImported: () => void
  /** Called when the user chooses "start from scratch" to dismiss onboarding. */
  onSkip: () => void
}

/**
 * Inline onboarding empty state for the Settings > Emotions tab, shown when no
 * emotions exist. Offers a one-click import of the 42-emotion curated starter
 * set in the language of the user's choice (defaulting to the current Kiroku
 * language), or a link to start from scratch.
 */
export function EmotionsOnboarding({ onImported, onSkip }: EmotionsOnboardingProps) {
  const { t, i18n } = useTranslation()
  // i18n.language may carry a region (e.g. "en-US"), so match against base codes.
  const [language, setLanguage] = useState<SupportedLanguage>(
    () => SUPPORTED_LANGUAGES.find((lang) => i18n.language?.startsWith(lang)) ?? 'en',
  )
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    setImporting(true)
    try {
      const created = await emotionsApi.bulkCreate(EMOTION_PRESETS[language])
      notifySuccess(
        t('settings.emotions.onboarding.notify_success', { count: created.length }),
      )
      onImported()
    } catch {
      notifyError(t('settings.emotions.onboarding.notify_error'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Stack align="center" gap="sm" maw={460} mx="auto" py="xl">
      <IconMoodSmile size={52} color="var(--mantine-color-dimmed)" />
      <Title order={3} ta="center">
        {t('settings.emotions.onboarding.title')}
      </Title>
      <Text c="dimmed" ta="center" maw={420}>
        {t('settings.emotions.onboarding.description')}
      </Text>
      <Select
        w={280}
        label={t('settings.emotions.onboarding.language_label')}
        data={LANGUAGE_OPTIONS}
        value={language}
        onChange={(value) => {
          if (value) {
            setLanguage(value as SupportedLanguage)
          }
        }}
        allowDeselect={false}
        disabled={importing}
      />
      <Text size="sm" c="dimmed">
        {t('settings.emotions.onboarding.count')}
      </Text>
      <Button size="md" onClick={handleImport} loading={importing}>
        {t('settings.emotions.onboarding.import_button')}
      </Button>
      <Anchor component="button" type="button" size="sm" onClick={onSkip} disabled={importing}>
        {t('settings.emotions.onboarding.skip')}
      </Anchor>
    </Stack>
  )
}
