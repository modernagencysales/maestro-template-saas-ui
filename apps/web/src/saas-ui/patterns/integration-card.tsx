import type { ComponentType } from "react";
import { Button, Card, HStack, Icon, Stack, Text } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 integration-card.tsx.
export function IntegrationCard({
  description,
  icon,
  name,
  onOpenDocs,
  onToggle,
  status,
  type,
}: {
  readonly description: string;
  readonly icon: ComponentType;
  readonly name: string;
  readonly onOpenDocs: () => void;
  readonly onToggle: () => void;
  readonly status: "connected" | "disconnected";
  readonly type: string;
}) {
  return (
    <Card.Root>
      <Card.Header>
        <HStack align="start">
          <Icon as={icon} boxSize="5" />
          <Stack gap="0">
            <Card.Title>{name}</Card.Title>
            <Text color="fg.muted" fontSize="sm">
              {type}
            </Text>
          </Stack>
        </HStack>
      </Card.Header>
      <Card.Body>
        <Text color="fg.muted">{description}</Text>
      </Card.Body>
      <Card.Footer gap="2">
        <Button
          onClick={onToggle}
          variant={status === "connected" ? "outline" : "solid"}
        >
          {status === "connected" ? "Disconnect" : "Connect"}
        </Button>
        <Button onClick={onOpenDocs} variant="ghost">
          Open docs
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
