import { Card, HStack, Tag, Text } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 task-card-with-labels.tsx.
export function TaskCard({
  dueLabel,
  labels,
  title,
}: {
  readonly dueLabel?: string;
  readonly labels: readonly string[];
  readonly title: string;
}) {
  return (
    <Card.Root>
      <Card.Body gap="3">
        <Text fontWeight="medium">{title}</Text>
        <HStack flexWrap="wrap">
          {labels.map((label) => (
            <Tag key={label}>{label}</Tag>
          ))}
        </HStack>
        {dueLabel ? (
          <Text color="fg.muted" fontSize="sm">
            {dueLabel}
          </Text>
        ) : null}
      </Card.Body>
    </Card.Root>
  );
}
