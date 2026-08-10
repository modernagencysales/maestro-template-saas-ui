import type { FormEvent, ReactNode } from "react";
import { Button, Card, Heading, Stack, Text } from "@saas-ui/react";

// Adapted from the pinned starter settings form and settings-card compositions.
export function FormSection({
  children,
  description,
  onSubmit,
  pending = false,
  title,
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly onSubmit: () => void | Promise<void>;
  readonly pending?: boolean;
  readonly title: string;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit();
  };
  return (
    <Card.Root as="section">
      <Card.Header>
        <Heading size="md">{title}</Heading>
        <Text color="fg.muted">{description}</Text>
      </Card.Header>
      <Card.Body>
        <form onSubmit={submit}>
          <Stack gap="4">
            {children}
            <Button alignSelf="flex-start" loading={pending} type="submit">
              Save changes
            </Button>
          </Stack>
        </form>
      </Card.Body>
    </Card.Root>
  );
}
