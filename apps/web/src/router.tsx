import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { Box, Heading, Spinner, Stack, Text } from "@saas-ui/react";
import type { ReactNode } from "react";

import "./react-global";
import { getWebEnv } from "./env";
import { routeTree } from "./routeTree.gen";

const TemplateRoutePending = () => <Spinner />;
const TemplateRouteError = ({
  title = "Something went wrong",
  description = "Please try again.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) => (
  <Stack gap="3" p="8">
    <Heading size="lg">{title}</Heading>
    <Text color="fg.muted">{description}</Text>
    {action ? <Box>{action}</Box> : null}
  </Stack>
);

export function getRouter() {
  const convexQueryClient = new ConvexQueryClient(getWebEnv().VITE_CONVEX_URL);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  });

  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingComponent: () => <TemplateRoutePending />,
    defaultErrorComponent: () => <TemplateRouteError />,
    defaultNotFoundComponent: () => (
      <TemplateRouteError
        title="Page not found"
        description="This route is not part of the template workspace."
        action={<a href="/">Return to overview</a>}
      />
    ),
    context: {
      queryClient,
      convexClient: convexQueryClient.convexClient,
      convexQueryClient,
    },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
