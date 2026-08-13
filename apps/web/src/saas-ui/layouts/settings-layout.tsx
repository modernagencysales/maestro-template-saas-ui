import type { ReactNode } from "react";
import { Box, Heading, Sidebar, Stack, Text } from "@saas-ui/react";
import { AppLayout } from "./app-layout";

// Adapted from the pinned starter settings layout with caller-owned navigation
// and content rather than starter account or billing services.
export function SettingsLayout({
  children,
  navigation,
  title,
}: {
  readonly children: ReactNode;
  readonly navigation?: ReactNode;
  readonly title: string;
}) {
  const sidebar = navigation ? (
    <Sidebar.Root aria-label="Settings navigation" borderRightWidth="1px">
      <Sidebar.Header>
        <Heading size="md">{title}</Heading>
      </Sidebar.Header>
      <Sidebar.Body>
        <Box as="nav">{navigation}</Box>
      </Sidebar.Body>
    </Sidebar.Root>
  ) : undefined;

  return (
    <AppLayout sidebar={sidebar}>
      <Box
        as="main"
        id="workspace-main"
        minH="100dvh"
        px={{ base: "4", md: "6" }}
        py="8"
        tabIndex={-1}
      >
        <Stack gap="6">
          <Box>
            <Heading size="2xl">{title}</Heading>
            <Text color="fg.muted">Workspace preferences and controls.</Text>
          </Box>
          <Box minW="0">{children}</Box>
        </Stack>
      </Box>
    </AppLayout>
  );
}
