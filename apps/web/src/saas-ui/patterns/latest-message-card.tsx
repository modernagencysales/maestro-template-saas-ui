import { Card, Stack, Text } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 latest-messages-card.tsx.
export interface MessageItem {
  readonly id: string;
  readonly author: string;
  readonly body: string;
  readonly sentAt: Date;
}
export function LatestMessageCard({
  locale,
  messages,
}: {
  readonly locale?: string;
  readonly messages: readonly MessageItem[];
}) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Latest messages</Card.Title>
      </Card.Header>
      <Card.Body>
        <Stack gap="4">
          {messages.map((message) => (
            <Stack gap="1" key={message.id}>
              <Text fontWeight="medium">{message.author}</Text>
              <Text>{message.body}</Text>
              <Text color="fg.muted" fontSize="sm">
                <time dateTime={message.sentAt.toISOString()}>
                  {formatter.format(message.sentAt)}
                </time>
              </Text>
            </Stack>
          ))}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
