import { Group, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import styles from './Logo.module.css'

export function Logo() {
  const { t } = useTranslation()

  return (
    <Group gap="xs" wrap="nowrap">
      <img
        src="/logo.svg"
        alt={t('app.logo_alt')}
        className={styles.mark}
      />
      <div className={styles['text-column']}>
        <Text size="xs" c="dimmed" lh={1.1}>記録</Text>
        <Text fw={700} size="sm" lh={1.1}>Kiroku</Text>
      </div>
    </Group>
  )
}
