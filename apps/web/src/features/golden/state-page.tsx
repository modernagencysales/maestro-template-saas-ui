import { Box, Button, Heading, Stack, Text } from "@saas-ui/react";
import * as React from "react";

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

const roles: Partial<Record<GoldenState, "alert" | "status">> = {
  loading: "status",
  "mutation-success": "status",
  "mutation-failure": "alert",
  error: "alert",
  "permission-denied": "alert",
};

const actions: Partial<
  Record<GoldenState, { label: string; next: GoldenState }>
> = {
  "ready-edit": { label: "Save changes", next: "mutation-success" },
  "mutation-failure": { label: "Try again", next: "mutation-success" },
  "mutation-success": { label: "Continue", next: "ready-read" },
  error: { label: "Retry", next: "loading" },
  "not-found": { label: "Back to records", next: "ready-read" },
};

export function GoldenStatePage({ state }: { state: GoldenState }) {
  const [resolvedState, setResolvedState] = React.useState(state);
  const [accessRequested, setAccessRequested] = React.useState(false);
  const action = actions[resolvedState];

  return (
    <Stack gap="6" p="8" aria-busy={resolvedState === "loading"}>
      <Box>
        <Heading size="lg">State fixture</Heading>
        <Text
          color="fg.muted"
          role={accessRequested ? "status" : roles[resolvedState]}
        >
          {accessRequested ? "Access request sent" : copy[resolvedState]}
        </Text>
      </Box>
      {action && (
        <Button onClick={() => setResolvedState(action.next)}>
          {action.label}
        </Button>
      )}
      {resolvedState === "permission-denied" && !accessRequested && (
        <Button onClick={() => setAccessRequested(true)}>Request access</Button>
      )}
    </Stack>
  );
}
