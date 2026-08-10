import { Button, Card, Grid, Heading, Stack, Text } from "@saas-ui/react";

// Adapted from the pinned starter billing/components/pricing-table.tsx without billing providers.
export interface PricingPlan {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly amount: number;
  readonly currency: string;
  readonly interval: string;
  readonly features: readonly string[];
}
export function PricingTable({
  locale,
  onSelect,
  plans,
}: {
  readonly locale?: string;
  readonly onSelect: (id: string) => void;
  readonly plans: readonly PricingPlan[];
}) {
  return (
    <Grid
      gap="4"
      templateColumns={{
        base: "minmax(0, 1fr)",
        md: "repeat(auto-fit, minmax(16rem, 1fr))",
      }}
    >
      {plans.map((plan) => {
        const price = new Intl.NumberFormat(locale, {
          currency: plan.currency,
          style: "currency",
        }).format(plan.amount);
        return (
          <Card.Root key={plan.id}>
            <Card.Header>
              <Heading size="lg">{plan.name}</Heading>
              <Text color="fg.muted">{plan.description}</Text>
            </Card.Header>
            <Card.Body gap="4">
              <Text textStyle="metric">
                {price} / {plan.interval}
              </Text>
              <Stack as="ul">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </Stack>
            </Card.Body>
            <Card.Footer>
              <Button onClick={() => onSelect(plan.id)}>
                Choose {plan.name}
              </Button>
            </Card.Footer>
          </Card.Root>
        );
      })}
    </Grid>
  );
}
