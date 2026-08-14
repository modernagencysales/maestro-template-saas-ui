import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { PageStateView } from "./saas-ui/patterns";

import "./react-global";
import { getWebEnv } from "./env";
import { routeTree } from "./routeTree.gen";

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
    defaultPendingComponent: () => (
      <PageStateView
        description="Preparing the workspace route."
        state="loading"
        title="Loading page"
      />
    ),
    defaultErrorComponent: () => (
      <PageStateView
        description="The page could not be loaded. Try again or return to a safe workspace page."
        state="failure"
        title="Something went wrong"
      />
    ),
    defaultNotFoundComponent: () => (
      <PageStateView
        action={{
          label: "Return to overview",
          onClick: () => window.location.assign("/"),
        }}
        description="This route is not part of the template workspace."
        state="not-found"
        title="Page not found"
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
