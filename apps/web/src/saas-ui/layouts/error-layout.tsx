import type { ReactNode } from "react";
import { Button, Container, Heading, Stack, Text } from "@saas-ui/react";

export function ErrorLayout({
  action,
  children,
  title,
}: {
  readonly action?: () => void;
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <Container
      alignItems="center"
      as="main"
      display="flex"
      id="workspace-main"
      minH="100dvh"
      py="12"
      tabIndex={-1}
    >
      <Stack gap="4" maxW="lg">
        <Text color="fg.muted" fontSize="sm">
          Workspace route
        </Text>
        <Heading size="2xl">{title}</Heading>
        <Text color="fg.muted">{children}</Text>
        {action ? (
          <Button alignSelf="flex-start" onClick={action} variant="outline">
            Try again
          </Button>
        ) : null}
      </Stack>
    </Container>
  );
}
