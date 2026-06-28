import { IconSearch } from '@tabler/icons-react'
import { Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { useTranslation } from 'react-i18next'

/**
 * Shown below a Manage table when active column filters eliminate every row.
 * Distinct from the "no records at all" empty state handled by DataStates.
 */
export function FilterEmptyState() {
  const { t } = useTranslation()
  return (
    <Center mih={160}>
      <Stack align="center" gap="xs">
        <ThemeIcon size={48} radius="xl" variant="light" color="gray">
          <IconSearch size={24} />
        </ThemeIcon>
        <Text fw={600}>{t('manage.no_match_title')}</Text>
        <Text c="dimmed" size="sm" ta="center">
          {t('manage.no_match_description')}
        </Text>
      </Stack>
    </Center>
  )
}
