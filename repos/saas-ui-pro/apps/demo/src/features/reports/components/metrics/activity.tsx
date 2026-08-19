import { Text, Timeline } from '@chakra-ui/react'

import { ActivityData } from '#api'
import { DateTime, RelativeTime } from '#i18n/date-helpers'
import { Avatar } from '#ui/avatar/avatar'
import { Tooltip } from '#ui/tooltip/tooltip'

import { MetricsCard } from './metrics-card'

const ActivityDate: React.FC<{ date: Date }> = (props) => {
  return (
    <Tooltip content={<DateTime date={props.date} />}>
      <Text as="span" color="muted">
        <RelativeTime date={props.date} />
      </Text>
    </Tooltip>
  )
}

export const Activity = ({ data }: { data: ActivityData[] }) => {
  return (
    <MetricsCard title="Activity">
      <Timeline.Root variant="outline">
        {data.map(({ contact, action, date }, i) => (
          <Timeline.Item key={i}>
            <Timeline.Connector>
              <Timeline.Indicator>
                <Avatar src={contact.avatar} size="2xs" name={contact.name} />
              </Timeline.Indicator>
            </Timeline.Connector>
            <Timeline.Content color="muted">
              <Text as="span" fontWeight="medium" color="chakra-body-text">
                {contact.name}
              </Text>{' '}
              <span>{action}</span> <span>·</span>{' '}
              <ActivityDate date={new Date(date)} />
            </Timeline.Content>
          </Timeline.Item>
        ))}
      </Timeline.Root>
    </MetricsCard>
  )
}
