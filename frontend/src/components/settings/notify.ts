import { notifications } from '@mantine/notifications'
import i18n from '@/i18n'

/**
 * Notification helpers shared by the Settings tabs.
 *
 * Per the design system, error toasts use orange (red is reserved for
 * financial loss) and success toasts use the Mantine default (green is
 * reserved for profit).
 */

export function notifySuccess(message: string): void {
  notifications.show({ message })
}

export function notifyError(message: string): void {
  notifications.show({ color: 'orange', title: i18n.t('common.notifications.error_title'), message })
}
