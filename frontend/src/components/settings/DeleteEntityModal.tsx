import { IconAlertTriangle } from '@tabler/icons-react'
import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from '@mantine/core'
import { useTranslation } from 'react-i18next'

interface DeleteEntityModalProps {
  opened: boolean
  /**
   * `cascade` (tags, emotions): always deletable; a trade count > 0 shows a
   * warning that the entity will be detached from those trades.
   * `guarded` (assets): a trade count > 0 blocks the delete entirely.
   */
  mode: 'cascade' | 'guarded'
  /** i18n key prefix for this entity's delete copy, e.g. `settings.tags.delete`. */
  i18nPrefix: string
  entityName: string
  /** Trade count for the entity, or `null` while it is still loading. */
  tradeCount: number | null
  countLoading: boolean
  countError: boolean
  deletePending: boolean
  onClose: () => void
  onConfirm: () => void
}

/**
 * Confirmation modal for deleting a Settings entity. Renders one of five
 * variants driven by `mode` and `tradeCount` (see issue #114 / mockups in
 * docs/mockups/issue-113). Follows the form-modal convention
 * `closeOnClickOutside={false}`.
 */
export function DeleteEntityModal({
  opened,
  mode,
  i18nPrefix,
  entityName,
  tradeCount,
  countLoading,
  countError,
  deletePending,
  onClose,
  onConfirm,
}: DeleteEntityModalProps) {
  const { t } = useTranslation()

  const isBlocked =
    mode === 'guarded' && tradeCount !== null && tradeCount > 0
  const isResolved = !countLoading && !countError && tradeCount !== null
  const showDestructive = isResolved && !isBlocked

  const title = isBlocked
    ? t(`${i18nPrefix}.blockedTitle`)
    : t(`${i18nPrefix}.title`)

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="md"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {countLoading || tradeCount === null ? (
          countError ? (
            <Text size="sm" c="orange">
              {t('settings.delete_count_error')}
            </Text>
          ) : (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          )
        ) : isBlocked ? (
          <>
            <Alert
              variant="light"
              color="orange"
              icon={<IconAlertTriangle size={20} />}
            >
              {t(`${i18nPrefix}.blocked`, { name: entityName, count: tradeCount })}
            </Alert>
            <Text size="sm" c="dimmed">
              {t(`${i18nPrefix}.blockedHint`)}
            </Text>
          </>
        ) : tradeCount > 0 ? (
          <>
            <Text size="sm">{t(`${i18nPrefix}.question`, { name: entityName })}</Text>
            <Alert
              variant="light"
              color="orange"
              icon={<IconAlertTriangle size={20} />}
            >
              {t(`${i18nPrefix}.warning`, { count: tradeCount })}
            </Alert>
            <Text size="sm" c="dimmed">
              {t(`${i18nPrefix}.undone`)}
            </Text>
          </>
        ) : (
          <Text size="sm">{t(`${i18nPrefix}.simple`, { name: entityName })}</Text>
        )}

        <Group justify="flex-end">
          {showDestructive ? (
            <>
              <Button variant="default" onClick={onClose} disabled={deletePending}>
                {t('common.actions.cancel')}
              </Button>
              <Button color="red" loading={deletePending} onClick={onConfirm}>
                {t('common.actions.delete')}
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={onClose}>
              {t('common.actions.close')}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
