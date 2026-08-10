import type { ReactNode } from "react";
import { Box, Card, Container, Heading, Stack } from "@saas-ui/react";

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// apps/web/src/features/auth/auth-layout.tsx and auth-card.tsx. No auth route,
// provider, testimonial, or fabricated identity is introduced.
export function AuthLayout({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <Box as="main" minH="100dvh" py={{ base: "8", md: "16" }}>
      <Container maxW="md" px="4">
        <Card.Root>
          <Card.Header>
            <Heading size="lg">{title}</Heading>
          </Card.Header>
          <Card.Body>
            <Stack gap="4">{children}</Stack>
          </Card.Body>
        </Card.Root>
      </Container>
    </Box>
  );
}
