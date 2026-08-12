import { Button, Field, Heading, Input, Stack, Text } from "@saas-ui/react";
import * as React from "react";

import { useGoldenState } from "./adapters";
import { goldenFixtures, type GoldenState } from "./fixtures";

export function GoldenFormPage({
  state = "ready-edit",
}: {
  state?: GoldenState;
}) {
  const fixtureState = useGoldenState();
  const resolvedState = state ?? fixtureState;
  const [name, setName] = React.useState<string>(
    goldenFixtures.form.projectName,
  );
  const [message, setMessage] = React.useState<"success" | "failure" | null>(
    resolvedState === "mutation-success"
      ? "success"
      : resolvedState === "mutation-failure"
        ? "failure"
        : null,
  );

  const save = () => {
    if (!name.trim()) {
      setMessage("failure");
      return;
    }
    setMessage(resolvedState === "mutation-failure" ? "failure" : "success");
  };

  return (
    <Stack gap="6" p={{ base: "5", md: "8" }} maxW="xl">
      <Heading size="lg">Form archetype</Heading>
      <Text color="fg.muted">
        Ready-edit and mutation success/failure are explicit fixtures.
      </Text>
      <Field.Root required>
        <Field.Label>Project name</Field.Label>
        <Input
          aria-label="Project name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </Field.Root>
      <Button onClick={save}>Save project</Button>
      {message === "success" && (
        <Text role="status">Changes saved successfully</Text>
      )}
      {message === "failure" && (
        <Text role="alert">
          {name.trim()
            ? "Changes could not be saved"
            : "Project name is required"}
        </Text>
      )}
    </Stack>
  );
}
