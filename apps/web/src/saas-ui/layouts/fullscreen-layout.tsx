import type { ReactNode } from "react";
import { AppShell, Box } from "@saas-ui/react";

// Adapted from the pinned starter fullscreen layout without product providers.
export function FullscreenLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <AppShell>
      <Box as="main" minH="100dvh" overflow="auto">
        {children}
      </Box>
    </AppShell>
  );
}
