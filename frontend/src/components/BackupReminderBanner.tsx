import { useState } from 'react'
import dayjs from 'dayjs'
import { Alert, Button, Group, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useFetch } from '@/hooks/useFetch'
import { backupApi } from '@/services/backup'
import { preferencesApi } from '@/services/preferences'
import { notifyError, notifySuccess } from '@/components/settings/notify'

const DISMISS_KEY = 'backup_reminder_dismissed_until'
const DAY_MS = 86_400_000

/**
 * Non-blocking reminder rendered above the page content when a backup is due.
 * It renders nothing (not an empty wrapper) whenever a reminder is not due, to
 * avoid affecting page layout.
 */
export function BackupReminderBanner() {
  const { t } = useTranslation()
  const { data } = useFetch(preferencesApi.get)

  // "Now" and the stored dismissal deadline are impure reads, so capture them
  // once via lazy initializers; render then stays pure and stable.
  const [now] = useState(() => Date.now())
  const [dismissedUntil, setDismissedUntil] = useState(() =>
    Number(localStorage.getItem(DISMISS_KEY) ?? '0'),
  )
  const [done, setDone] = useState(false)
  const [backingUp, setBackingUp] = useState(false)

  if (!data || done) {
    return null
  }
  if (!data.backup_directory || data.backup_reminder_days <= 0) {
    return null
  }
  if (dismissedUntil > now) {
    return null
  }

  const daysSince = data.last_backup_at
    ? dayjs(now).diff(dayjs(data.last_backup_at), 'day')
    : null
  const overdue = daysSince === null || daysSince > data.backup_reminder_days
  if (!overdue) {
    return null
  }

  const message =
    daysSince === null
      ? t('backup.reminder.never')
      : t('backup.reminder.overdue', { count: daysSince })

  const handleBackupNow = async () => {
    setBackingUp(true)
    try {
      const result = await backupApi.create()
      setDone(true)
      notifySuccess(t('settings.backup.notify_success', { filename: result.filename }))
    } catch {
      notifyError(t('settings.backup.notify_error'))
    } finally {
      setBackingUp(false)
    }
  }

  const handleNotNow = () => {
    const until = Date.now() + DAY_MS
    localStorage.setItem(DISMISS_KEY, String(until))
    setDismissedUntil(until)
  }

  return (
    <Alert
      color="orange"
      variant="light"
      radius="md"
      mb="md"
      icon={<IconAlertTriangle />}
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text>{message}</Text>
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant="filled"
            loading={backingUp}
            onClick={() => void handleBackupNow()}
          >
            {t('backup.reminder.backup_now')}
          </Button>
          <Button
            size="compact-sm"
            variant="subtle"
            c="dimmed"
            onClick={handleNotNow}
          >
            {t('backup.reminder.not_now')}
          </Button>
        </Group>
      </Group>
    </Alert>
  )
}
