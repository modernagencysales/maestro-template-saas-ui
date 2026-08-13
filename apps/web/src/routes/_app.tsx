import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireAuthenticatedRoute } from "#lib/auth/route-auth";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ location }) => {
    return requireAuthenticatedRoute({ location });
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
  // pendingComponent: AppLoader,
  component: () => {
    return <Outlet />;
  },
});
