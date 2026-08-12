import { Box, Button, Code, HStack, Stack } from "@saas-ui/react";
import {
  ErrorComponentProps,
  rootRouteId,
  useMatch,
  useRouter,
} from "@tanstack/react-router";
import { LuTriangleAlert } from "react-icons/lu";

import { ErrorPage } from "./error-page";
import { LinkButton } from "./link-button";

const isDev = import.meta.env.DEV;

export function DefaultErrorPage({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    shouldThrow: false,
    select: (state) => state.id === rootRouteId,
  });

  return (
    <ErrorPage
      title="Something went wrong"
      description="We've been notified about the problem."
      icon={<LuTriangleAlert />}
    >
      <Stack gap="10">
        <HStack width="full" justify="center">
          <Button
            variant="surface"
            size="sm"
            onClick={() => {
              router.invalidate();
            }}
          >
            Try Again
          </Button>
          {isRoot ? (
            <LinkButton variant="outline" size="sm" to="/">
              Home
            </LinkButton>
          ) : (
            <LinkButton
              variant="outline"
              size="sm"
              to="/"
              onClick={(e) => {
                e.preventDefault();
                window.history.back();
              }}
            >
              Go Back
            </LinkButton>
          )}
        </HStack>

        {isDev && (
          <Box maxW="90vw" overflowX="auto">
            <Code p="4">
              <pre>{error.stack ?? error.message}</pre>
            </Code>
          </Box>
        )}
      </Stack>
    </ErrorPage>
  );
}
