import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingOverlay,
  Page,
  Stack,
  Text,
} from "@saas-ui/react";
import { useControllableState } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { createGoldenAdapter, type GoldenFrontendAdapter } from "./adapters";
import type { GoldenState } from "./fixtures";

export function GoldenStatePage({
  state,
  adapter = createGoldenAdapter(),
}: {
  state: GoldenState;
  adapter?: GoldenFrontendAdapter;
}) {
  const [resolvedState, setResolvedState] = useControllableState({
    defaultValue: state,
  });
  const [accessRequested, setAccessRequested] = useControllableState({
    defaultValue: false,
  });

  const transition = async (
    action: Parameters<typeof adapter.transitionState>[1],
  ) => {
    const next = await adapter.transitionState(resolvedState, action);
    if (next === "access-requested") {
      setAccessRequested(true);
    } else {
      setResolvedState(next);
    }
  };

  const contentByState: Record<GoldenState, ReactNode> = {
    loading: (
      <LoadingOverlay.Root>
        <LoadingOverlay.Spinner />
        <Text role="status">Loading workspace data</Text>
      </LoadingOverlay.Root>
    ),
    empty: (
      <EmptyState
        title="No records yet"
        description="Create a record to see it here."
      />
    ),
    "ready-read": (
      <Card.Root variant="subtle">
        <Card.Body as={Stack} gap="4">
          <Text role="status">Records are ready to review</Text>
          <Button onClick={() => void transition("edit")}>Edit record</Button>
        </Card.Body>
      </Card.Root>
    ),
    "ready-edit": (
      <Card.Root variant="subtle">
        <Card.Body as={Stack} gap="4">
          <Text>Edit mode is enabled</Text>
          <Field.Root>
            <Field.Label>Record name</Field.Label>
            <Input defaultValue="Northstar record" />
          </Field.Root>
          <Button onClick={() => void transition("save")}>Save changes</Button>
        </Card.Body>
      </Card.Root>
    ),
    "mutation-success": (
      <EmptyState
        title="Changes saved successfully"
        description={<Text role="status">Changes saved successfully</Text>}
      >
        <Button onClick={() => void transition("continue")}>Continue</Button>
      </EmptyState>
    ),
    "mutation-failure": (
      <EmptyState
        title="Changes could not be saved"
        description={<Text role="alert">Changes could not be saved</Text>}
      >
        <Button onClick={() => void transition("retry")}>Try again</Button>
      </EmptyState>
    ),
    error: (
      <EmptyState
        title="Something went wrong"
        description={<Text role="alert">Something went wrong</Text>}
      >
        <Button onClick={() => void transition("retry")}>Retry</Button>
      </EmptyState>
    ),
    "not-found": (
      <EmptyState
        title="Record not found"
        description="The requested record was not found"
      >
        <Button onClick={() => void transition("back")}>Back to records</Button>
      </EmptyState>
    ),
    "permission-denied": (
      <EmptyState
        title="Permission denied"
        description={
          <Text role={accessRequested ? undefined : "alert"}>
            You do not have permission to view this record
          </Text>
        }
      >
        {accessRequested ? (
          <Text role="status">Access request sent</Text>
        ) : (
          <Button onClick={() => void transition("request-access")}>
            Request access
          </Button>
        )}
      </EmptyState>
    ),
  };

  return (
    <Page.Root aria-busy={resolvedState === "loading"}>
      <Page.Header title="State fixture" />
      <Page.Body p={{ base: "5", md: "8" }}>
        {contentByState[resolvedState]}
      </Page.Body>
    </Page.Root>
  );
}
