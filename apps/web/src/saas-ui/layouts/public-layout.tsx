import type { ReactNode } from "react";
import { Box, Container } from "@saas-ui/react";

// Adapted from the pinned starter's route/layout composition. Public copy and
// journeys remain owned by their routes; this file supplies structure only.
export function PublicLayout({ children }: { readonly children: ReactNode }) {
  return (
    <Box as="main" minH="100dvh" pb="max(4rem, env(safe-area-inset-bottom))">
      <Container maxW="7xl" px={{ base: "4", md: "6" }}>
        {children}
      </Container>
    </Box>
  );
}
