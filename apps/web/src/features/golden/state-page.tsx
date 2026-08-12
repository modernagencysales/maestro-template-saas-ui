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
  const resolvedState = state;
  const messageRole =
    resolvedState === "mutation-failure" ||
    resolvedState === "error" ||
    resolvedState === "permission-denied"
      ? "alert"
      : resolvedState === "loading" || resolvedState === "mutation-success"
        ? "status"
        : undefined;

  return (
    <Stack gap="6" p="8" aria-busy={resolvedState === "loading"}>
      <Box>
        <Heading size="lg">State fixture</Heading>
        <Text color="fg.muted" role={messageRole}>
          {copy[resolvedState]}
        </Text>
      </Box>
      {(resolvedState === "ready-edit" ||
        resolvedState === "mutation-failure") && <Button>Save changes</Button>}
      {resolvedState === "mutation-success" && <Button>Continue</Button>}
    </Stack>
  );
}
