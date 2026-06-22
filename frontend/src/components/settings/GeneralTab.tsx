import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import {
  Alert,
  Button,
  Card,
  FileInput,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconAlertTriangle, IconUpload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES } from '@/i18n'
import { useFetch } from '@/hooks/useFetch'
import { ApiError } from '@/services/api'
import { backupApi } from '@/services/backup'
import { preferencesApi } from '@/services/preferences'
import type { BackupMetadata } from '@/types/backup'
import { notifyError, notifySuccess } from './notify'

dayjs.extend(localizedFormat)

/** True when `candidate` is a strictly newer dotted version than `base`. */
function isNewerVersion(candidate: string, base: string): boolean {
  const toParts = (value: string) => value.split('.').map((n) => parseInt(n, 10) || 0)
  const a = toParts(candidate)
  const b = toParts(base)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const ai = a[i] ?? 0
    const bi = b[i] ?? 0
    if (ai !== bi) {
      return ai > bi
    }
  }
  return false
}

export function GeneralTab() {
  const { t, i18n } = useTranslation()
  const { data } = useFetch(preferencesApi.get)

  // i18n.language may carry a region (e.g. "en-US" from the browser detector),
  // so match the Select value against the supported base codes.
  const current =
    SUPPORTED_LANGUAGES.find((lang) => i18n.language?.startsWith(lang)) ?? 'en'

  const handleLanguageChange = (value: string | null) => {
    if (value) {
      i18n.changeLanguage(value)
    }
  }

  // Editable backup directory and the last successfully persisted value. The
  // "Back up now" button keys off the persisted value, not the draft.
  const [directory, setDirectory] = useState('')
  const [savedDirectory, setSavedDirectory] = useState<string | null>(null)
  const [reminderDays, setReminderDays] = useState(7)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const [savingPath, setSavingPath] = useState(false)
  const [backingUp, setBackingUp] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [validating, setValidating] = useState(false)
  const [metadata, setMetadata] = useState<BackupMetadata | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [modalOpened, modal] = useDisclosure(false)

  // Seed the editable mirror from the fetched preferences exactly once.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !data) {
      return
    }
    seeded.current = true
    setDirectory(data.backup_directory ?? '')
    setSavedDirectory(data.backup_directory)
    setReminderDays(data.backup_reminder_days)
    setLastBackupAt(data.last_backup_at)
  }, [data])

  const handleSavePath = async () => {
    setSavingPath(true)
    setDirectoryError(null)
    const next = directory.trim() === '' ? null : directory.trim()
    try {
      await preferencesApi.update({ backup_directory: next })
      setSavedDirectory(next)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 400) {
        setDirectoryError(t('settings.backup.directory_error'))
      } else {
        notifyError(t('settings.backup.save_error'))
      }
    } finally {
      setSavingPath(false)
    }
  }

  const handleReminderChange = (value: string | null) => {
    if (value === null) {
      return
    }
    const next = Number(value)
    const previous = reminderDays
    setReminderDays(next)
    preferencesApi.update({ backup_reminder_days: next }).catch(() => {
      setReminderDays(previous)
      notifyError(t('settings.backup.save_error'))
    })
  }

  const handleBackupNow = async () => {
    setBackingUp(true)
    try {
      const result = await backupApi.create()
      setLastBackupAt(result.created_at)
      notifySuccess(t('settings.backup.notify_success', { filename: result.filename }))
    } catch {
      notifyError(t('settings.backup.notify_error'))
    } finally {
      setBackingUp(false)
    }
  }

  const handleFileChange = async (next: File | null) => {
    setFile(next)
    if (!next) {
      return
    }
    setValidating(true)
    try {
      const result = await backupApi.validate(next)
      setMetadata(result)
      modal.open()
    } catch {
      setFile(null)
      notifyError(t('settings.restore.validate_error'))
    } finally {
      setValidating(false)
    }
  }

  const handleCloseModal = () => {
    modal.close()
    setFile(null)
    setMetadata(null)
  }

  const handleRestore = async () => {
    if (!file) {
      return
    }
    setRestoring(true)
    try {
      await backupApi.restore(file)
      // The database was just replaced — a full reload is the only safe way to
      // discard all stale React state, cached fetches and router state.
      window.location.reload()
    } catch {
      setRestoring(false)
      notifyError(t('settings.restore.notify_error'))
      handleCloseModal()
    }
  }

  const reminderOptions = [
    { value: '7', label: t('settings.backup.reminder_every_7') },
    { value: '14', label: t('settings.backup.reminder_every_14') },
    { value: '30', label: t('settings.backup.reminder_every_30') },
    { value: '0', label: t('settings.backup.reminder_disabled') },
  ]

  const lastBackupLabel = lastBackupAt
    ? t('settings.backup.last_backup', { when: dayjs(lastBackupAt).format('LLL') })
    : t('settings.backup.last_backup_never')

  const versionMismatch =
    metadata !== null && isNewerVersion(metadata.version, __APP_VERSION__)

  return (
    <Stack gap="md" maw={520}>
      <Card withBorder padding="md" radius="md">
        <Stack gap="md">
          <Title order={4}>{t('settings.general.language_label')}</Title>
          <Select
            description={t('settings.general.language_description')}
            data={LANGUAGE_OPTIONS}
            value={current}
            onChange={handleLanguageChange}
            allowDeselect={false}
            maw={320}
          />
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="md">
          <Title order={4}>{t('settings.backup.title')}</Title>

          <Stack gap="xs">
            <TextInput
              label={t('settings.backup.directory_label')}
              description={t('settings.backup.directory_description')}
              value={directory}
              onChange={(event) => setDirectory(event.currentTarget.value)}
              error={directoryError}
            />
            <Group>
              <Button
                variant="light"
                size="xs"
                loading={savingPath}
                onClick={() => void handleSavePath()}
              >
                {t('settings.backup.save_path')}
              </Button>
            </Group>
          </Stack>

          <Select
            label={t('settings.backup.reminder_label')}
            description={t('settings.backup.reminder_description')}
            data={reminderOptions}
            value={String(reminderDays)}
            onChange={handleReminderChange}
            allowDeselect={false}
            maw={320}
          />

          <Text c="dimmed" fz="sm">
            {lastBackupLabel}
          </Text>

          <Group>
            <Tooltip
              label={t('settings.backup.backup_now_disabled_tooltip')}
              disabled={savedDirectory !== null}
            >
              <Button
                loading={backingUp}
                disabled={savedDirectory === null}
                onClick={() => void handleBackupNow()}
              >
                {t('settings.backup.backup_now')}
              </Button>
            </Tooltip>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="md">
          <Title order={4}>{t('settings.restore.title')}</Title>
          <FileInput
            label={t('settings.restore.upload_label')}
            accept=".zip"
            value={file}
            onChange={(next) => void handleFileChange(next)}
            disabled={validating}
            leftSection={<IconUpload size={16} />}
            clearable
          />
        </Stack>
      </Card>

      <Modal
        opened={modalOpened}
        onClose={handleCloseModal}
        title={t('settings.restore.modal_title')}
        centered
        size="md"
        closeOnClickOutside={false}
      >
        {metadata !== null && (
          <Stack gap="md">
            <Text>
              {t('settings.restore.summary', {
                date: dayjs(metadata.created_at).format('LL'),
                version: metadata.version,
                trades: metadata.trades_count,
                screenshots: metadata.screenshots_count,
              })}
            </Text>

            {versionMismatch && (
              <Alert color="orange" variant="light" icon={<IconAlertTriangle />}>
                {t('settings.restore.version_warning')}
              </Alert>
            )}

            <Text c="dimmed" fz="sm">
              {t('settings.restore.destructive_warning')}
            </Text>

            <Group justify="flex-end">
              <Button variant="default" onClick={handleCloseModal}>
                {t('common.actions.cancel')}
              </Button>
              <Button
                color="red"
                variant="filled"
                loading={restoring}
                onClick={() => void handleRestore()}
              >
                {t('settings.restore.confirm')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
