import { Text, Timeline } from "@chakra-ui/react";
import { Tooltip } from "@saas-ui/react";

import type { ContactDTO } from "@workspace/api/types";
import { DateTime, RelativeTime } from "@workspace/i18n";

import { ContactAvatar } from "#features/contacts/common/contact-avatar";

import { MetricsCard } from "./metrics-card";

export interface ActivityData {
  contact: ContactDTO;
  action: string;
  date: string;
}

const ActivityDate: React.FC<{ date: Date }> = (props) => {
  return (
    <Tooltip content={<DateTime date={props.date} />}>
      <Text as="span" color="muted">
        <RelativeTime date={props.date} />
      </Text>
    </Tooltip>
  );
};

export const Activity = ({ data }: { data: ActivityData[] }) => {
  return (
    <MetricsCard title="Activity">
      <Timeline.Root variant="outline">
        {data.map(({ contact, action, date }, i) => (
          <Timeline.Item key={i}>
            <Timeline.Separator>
              {i > 0 && <Timeline.Connector />}
              <Timeline.Indicator>
                <ContactAvatar contact={contact} size="2xs" />
              </Timeline.Indicator>
              {i < data.length - 1 && <Timeline.Connector />}
            </Timeline.Separator>
            <Timeline.Content color="muted">
              <Text as="span" fontWeight="medium" color="chakra-body-text">
                {contact.name}
              </Text>{" "}
              <span>{action}</span> <span>·</span>{" "}
              <ActivityDate date={new Date(date)} />
            </Timeline.Content>
          </Timeline.Item>
        ))}
      </Timeline.Root>
    </MetricsCard>
  );
};
