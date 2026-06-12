import { useTranslation } from 'react-i18next'
import { Text } from '@mantine/core'
import classes from './EventLegend.module.css'

/**
 * Legend strip below the calendar/list explaining the four event styles:
 * Live (counts), Demo (excluded), Test (excluded), and the amber
 * missed_opportunity status. Shown in both the calendar and list views so the
 * "doesn't count" treatment of demo/test trades is always documented in place.
 */
export function EventLegend() {
  const { t } = useTranslation()

  const items = [
    { key: 'live', swatch: classes.live, label: t('journal.legend.live') },
    { key: 'demo', swatch: classes.demo, label: t('journal.legend.demo') },
    { key: 'test', swatch: classes.test, label: t('journal.legend.test') },
    { key: 'missed', swatch: classes.missed, label: t('journal.legend.missed') },
  ]

  return (
    <div className={classes.legend}>
      {items.map((item) => (
        <span key={item.key} className={classes.item}>
          <span className={`${classes.swatch} ${item.swatch}`} />
          <Text size="xs" c="dimmed">
            {item.label}
          </Text>
        </span>
      ))}
    </div>
  )
}
