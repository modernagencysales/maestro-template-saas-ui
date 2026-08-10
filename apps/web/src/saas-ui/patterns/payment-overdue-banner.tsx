import { Button, HStack, Text } from "@saas-ui/react";

// Adapted from the pinned starter billing/components/payment-overdue-banner.tsx without checkout calls.
export function PaymentOverdueBanner({
  onResolve,
}: {
  readonly onResolve: () => void;
}) {
  return (
    <HStack
      bg="bg.muted"
      borderWidth="1px"
      flexWrap="wrap"
      gap="3"
      p="3"
      role="alert"
    >
      <Text flex="1">
        Payment is overdue. Update the payment method to keep service active.
      </Text>
      <Button onClick={onResolve} size="sm">
        Update payment method
      </Button>
    </HStack>
  );
}
