import { Box, Button, Heading, Stack, Text } from "@saas-ui/react";

import type { GoldenState } from "./fixtures";

const copy: Record<GoldenState, string> = {
  loading: "Loading workspace data",
  empty: "No records yet",
  "ready-read": "Records are ready to review",
  "ready-edit": "Edit mode is enabled",
  "mutation-success": "Changes saved successfully",
  "mutation-failure": "Changes could not be saved",
  error: "Something went wrong",
  "not-found": "The requested record was not found",
  "permission-denied": "You do not have permission to view this record",
};

export function GoldenStatePage({ state }: { state: GoldenState }) {
  return (
    <Stack gap="6" p="8" data-testid={`golden-state-${state}`}>
      <Box>
        <Heading size="lg">State fixture</Heading>
        <Text color="fg.muted">{copy[state]}</Text>
      </Box>
      {(state === "ready-edit" || state === "mutation-failure") && (
        <Button>Save changes</Button>
      )}
      {state === "mutation-success" && <Button>Continue</Button>}
    </Stack>
  );
}
