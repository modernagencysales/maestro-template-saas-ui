import type { ElementType, ReactNode } from "react";
import {
  Box,
  Button,
  Card,
  Heading,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Text,
} from "@saas-ui/react";

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// workspace.loading, workspace.not-found, and contact route-state compositions.
export type PageState =
  "loading" | "empty" | "read" | "edit" | "success" | "failure" | "not-found";

export function PageStateView({
  action,
  children,
  description,
  state,
  title,
}: {
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly children?: ReactNode;
  readonly description: string;
  readonly state: PageState;
  readonly title: string;
}) {
  if (state === "loading") {
    return (
      <Stack aria-label={title} gap="3" role="status">
        <Text>Loading {title.toLocaleLowerCase()}…</Text>
        <Skeleton height="10" />
        <Skeleton height="24" />
      </Stack>
    );
  }

  const isFailure = state === "failure";
  const isReady = state === "read" || state === "edit";
  const stateLabel = state === "not-found" ? "Not found" : title;

  return (
    <Card.Root maxW="2xl" role={isFailure ? "alert" : "status"}>
      <Card.Body gap="3">
        <Box>
          <Heading size="md">{stateLabel}</Heading>
          <Text color="fg.muted" textWrap="pretty">
            {description}
          </Text>
        </Box>
        {isReady ? children : null}
        {action ? (
          <Button
            alignSelf="flex-start"
            onClick={action.onClick}
            variant="outline"
          >
            {action.label}
          </Button>
        ) : null}
      </Card.Body>
    </Card.Root>
  );
}

export function StateNotice({
  children,
  icon,
  state,
  title,
}: {
  readonly children: ReactNode;
  readonly icon: ElementType;
  readonly state: "loading" | "neutral" | "success" | "warning" | "failure";
  readonly title: string;
}) {
  return (
    <HStack
      align="flex-start"
      bg="bg.muted"
      borderWidth="1px"
      data-state={state}
      gap="3"
      p="4"
      role={state === "failure" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" as={icon} boxSize="5" />
      <Box>
        <Text fontWeight="semibold">{title}</Text>
        <Text color="fg.muted" fontSize="sm" mt="1">
          {children}
        </Text>
      </Box>
    </HStack>
  );
}
