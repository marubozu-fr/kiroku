import { useTranslation } from 'react-i18next'
import { Chip, Group, Text, Tooltip } from '@mantine/core'
import type { AccountType } from '@/types/trade'

interface AccountTypeTogglesProps {
  /** Currently shown account types. `live` is always present. */
  value: Set<AccountType>
  /** Called with the next selection (`live` is re-added if dropped). */
  onChange: (next: Set<AccountType>) => void
}

/**
 * View-toolbar filter selecting which account types the calendar/list render.
 *
 * A `Chip.Group` (multiple): Live is pinned on and non-deselectable (the
 * primary view), Demo and Test are opt-in supplementary chips (default off).
 * This only affects rendering — stats and reviews stay live-only regardless.
 */
export function AccountTypeToggles({ value, onChange }: AccountTypeTogglesProps) {
  const { t } = useTranslation()

  const handleChange = (values: string[]) => {
    const next = new Set(values as AccountType[])
    next.add('live') // Live can never be turned off.
    onChange(next)
  }

  return (
    <Group gap="xs" align="center">
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
        {t('journal.account_type.label')}
      </Text>
      <Chip.Group multiple value={[...value]} onChange={handleChange}>
        <Group gap="xs">
          <Tooltip label={t('journal.account_type.live_locked_hint')}>
            <Chip value="live" variant="light" color="blue" disabled>
              {t('journal.account_type.live')}
            </Chip>
          </Tooltip>
          <Chip value="demo" variant="light" color="indigo">
            {t('journal.account_type.demo')}
          </Chip>
          <Chip value="test" variant="light" color="gray">
            {t('journal.account_type.test')}
          </Chip>
        </Group>
      </Chip.Group>
    </Group>
  )
}
