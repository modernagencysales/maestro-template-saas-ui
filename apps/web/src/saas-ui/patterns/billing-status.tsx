import { Button, Card, HStack, Stack, Text } from "@saas-ui/react";

// Adapted from the pinned starter common/components/billing-status.tsx without billing context.
export function BillingStatus({
  description,
  label,
  onManage,
  status,
}: {
  readonly description: string;
  readonly label: string;
  readonly onManage: () => void;
  readonly status: "active" | "trial" | "past-due" | "inactive";
}) {
  return (
    <Card.Root>
      <Card.Body>
        <HStack>
          <Stack flex="1" gap="0">
            <Text fontWeight="medium">{label}</Text>
            <Text color="fg.muted" fontSize="sm">
              {description}
            </Text>
          </Stack>
          <Text>{status === "past-due" ? "Payment overdue" : status}</Text>
          <Button onClick={onManage} variant="outline">
            Manage billing
          </Button>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
