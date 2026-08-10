import type { ReactNode } from "react";
import { Box, Grid, Heading, Stack, Text } from "@saas-ui/react";

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
  return (
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
        <Grid
          gap={{ base: "6", lg: "10" }}
          templateColumns={{
            base: "minmax(0, 1fr)",
            lg: "14rem minmax(0, 1fr)",
          }}
        >
          {navigation ? <Box as="nav">{navigation}</Box> : <Box />}
          <Box minW="0">{children}</Box>
        </Grid>
      </Stack>
    </Box>
  );
}
