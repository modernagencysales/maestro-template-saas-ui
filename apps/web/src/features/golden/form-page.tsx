import { Button, Field, Heading, Input, Stack, Text } from "@saas-ui/react";
import * as React from "react";

import type { GoldenState } from "./fixtures";

export function GoldenFormPage({
  state = "ready-edit",
}: {
  state?: GoldenState;
}) {
  const [saved, setSaved] = React.useState(state === "mutation-success");
  return (
    <Stack gap="6" p={{ base: "5", md: "8" }} maxW="xl">
      <Heading size="lg">Form archetype</Heading>
      <Text color="fg.muted">
        Ready-edit and mutation success/failure are explicit fixtures.
      </Text>
      <Field.Root required>
        <Field.Label>Project name</Field.Label>
        <Input defaultValue="Northstar launch" aria-label="Project name" />
      </Field.Root>
      <Button onClick={() => setSaved(state !== "mutation-failure")}>
        Save project
      </Button>
      {saved && <Text role="status">Changes saved successfully</Text>}
      {state === "mutation-failure" && !saved && (
        <Text role="alert">Changes could not be saved</Text>
      )}
    </Stack>
  );
}
