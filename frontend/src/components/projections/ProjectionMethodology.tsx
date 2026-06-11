import { useTranslation } from 'react-i18next'
import { Accordion, List, Text } from '@mantine/core'

export function ProjectionMethodology() {
  const { t } = useTranslation()

  return (
    <Accordion variant="contained" radius="md">
      <Accordion.Item value="methodology">
        <Accordion.Control>
          <Text fw={600} size="sm">
            {t('projections.methodology.title')}
          </Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Text size="sm" mb="sm">
            {t('projections.methodology.intro')}
          </Text>
          <List size="sm" spacing="sm">
            <List.Item>
              <Text size="sm" component="span" fw={600}>
                {t('projections.methodology.step1_title')}
              </Text>{' '}
              {t('projections.methodology.step1_body')}
            </List.Item>
            <List.Item>
              <Text size="sm" component="span" fw={600}>
                {t('projections.methodology.step2_title')}
              </Text>{' '}
              {t('projections.methodology.step2_body')}
            </List.Item>
            <List.Item>
              <Text size="sm" component="span" fw={600}>
                {t('projections.methodology.step3_title')}
              </Text>{' '}
              {t('projections.methodology.step3_body')}
            </List.Item>
            <List.Item>
              <Text size="sm" component="span" fw={600}>
                {t('projections.methodology.step4_title')}
              </Text>{' '}
              {t('projections.methodology.step4_body')}
            </List.Item>
            <List.Item>
              <Text size="sm" component="span" fw={600}>
                {t('projections.methodology.step5_title')}
              </Text>{' '}
              {t('projections.methodology.step5_body')}
            </List.Item>
          </List>
          <Text size="sm" mt="sm" c="dimmed">
            {t('projections.methodology.disclaimer')}
          </Text>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  )
}
