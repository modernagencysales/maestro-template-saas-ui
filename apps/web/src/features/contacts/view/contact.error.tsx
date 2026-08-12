import { Button } from "@chakra-ui/react";
import { EmptyState } from "@saas-ui/react";
import type { ErrorComponentProps } from "@tanstack/react-router";

export function ContactError(props: ErrorComponentProps) {
  return (
    <EmptyState
      title="Failed to load contact"
      description="An error occurred while loading the contact."
      height="full"
    >
      <Button onClick={props.reset}>Try again</Button>
    </EmptyState>
  );
}
