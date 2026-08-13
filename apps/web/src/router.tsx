import { createRouter as createTanstackRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { createCompatibilityApi } from "#lib/trpc/react";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const convexQueryClient = new ConvexQueryClient(
    import.meta.env.VITE_CONVEX_URL,
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);
  const router = createTanstackRouter({
    routeTree,
    context: {
      queryClient,
      trpc: createCompatibilityApi(convexQueryClient.convexClient),
      convexClient: convexQueryClient.convexClient,
      convexQueryClient,
    },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
