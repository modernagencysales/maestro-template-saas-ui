import { Card, HStack, Heading, Text } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 metric-card-simple.tsx.
export function KpiCard({
  change,
  label,
  value,
}: {
  readonly change?: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <Card.Root>
      <Card.Body>
        <Text color="fg.muted" fontSize="sm">
          {label}
        </Text>
        <HStack align="baseline">
          <Heading size="2xl" textStyle="metric">
            {value}
          </Heading>
          {change ? <Text fontSize="sm">{change}</Text> : null}
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
