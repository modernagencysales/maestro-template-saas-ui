import { Box, Text, Timeline } from "@saas-ui/react";

// Adapted from the pinned starter contacts/view/activity-timeline.tsx.
export interface ActivityItem {
  readonly id: string;
  readonly label: string;
  readonly occurredAt: Date;
}

export function ActivityTimeline({
  activities,
  locale,
}: {
  readonly activities: readonly ActivityItem[];
  readonly locale?: string;
}) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Timeline.Root aria-label="Activity">
      {activities.map((activity) => (
        <Timeline.Item key={activity.id}>
          <Timeline.Separator />
          <Timeline.Connector>
            <Timeline.Indicator />
          </Timeline.Connector>
          <Timeline.Content>
            <Box>
              <Text>{activity.label}</Text>
              <Text color="fg.muted" fontSize="sm">
                <time dateTime={activity.occurredAt.toISOString()}>
                  {formatter.format(activity.occurredAt)}
                </time>
              </Text>
            </Box>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline.Root>
  );
}
