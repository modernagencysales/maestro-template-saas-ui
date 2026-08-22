import { createRouter as createTanstackRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { getQueryClient } from "#lib/react-query";
import { createCompatibilityApi } from "#lib/trpc/react";
import { isFixtureAuthRuntime } from "#lib/auth/route-auth";
import { resolveRuntimeConvex } from "#lib/convex/runtime-convex";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const runtime = resolveRuntimeConvex({
    fixture: isFixtureAuthRuntime(),
    url: (import.meta as ImportMeta & { env: { VITE_CONVEX_URL?: string } }).env
      .VITE_CONVEX_URL,
  });
  const convexQueryClient = new ConvexQueryClient(runtime.url);
  const queryClient = getQueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  if (runtime.connect) convexQueryClient.connect(queryClient);
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
