import { createRouter as createTanstackRouter } from "@tanstack/react-router";

import { getQueryClient } from "#lib/react-query";
import { trpc } from "#lib/trpc/react";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createTanstackRouter({
    routeTree,
    context: { queryClient: getQueryClient(), trpc },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
