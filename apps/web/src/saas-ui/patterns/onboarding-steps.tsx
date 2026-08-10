import { Button, Card, Progress, Stack, Text } from "@saas-ui/react";

// Adapted from the pinned starter getting-started/onboarding-step.tsx and onboarding-layout.tsx.
export function OnboardingSteps({
  current,
  onSelect,
  steps,
}: {
  readonly current: number;
  readonly onSelect: (index: number) => void;
  readonly steps: readonly {
    readonly id: string;
    readonly label: string;
    readonly description: string;
  }[];
}) {
  const progress =
    steps.length === 0 ? 0 : ((current + 1) / steps.length) * 100;
  return (
    <Card.Root maxW="2xl">
      <Card.Body gap="5">
        <Progress.Root value={progress}>
          <Progress.Track>
            <Progress.Range />
          </Progress.Track>
        </Progress.Root>
        <Stack as="ol" gap="3">
          {steps.map((step, index) => (
            <li key={step.id}>
              <Button
                aria-current={index === current ? "step" : undefined}
                justifyContent="flex-start"
                onClick={() => onSelect(index)}
                variant={index === current ? "subtle" : "ghost"}
                width="full"
              >
                <Stack align="start" gap="0">
                  <Text fontWeight="medium">{step.label}</Text>
                  <Text color="fg.muted" fontSize="sm">
                    {step.description}
                  </Text>
                </Stack>
              </Button>
            </li>
          ))}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
