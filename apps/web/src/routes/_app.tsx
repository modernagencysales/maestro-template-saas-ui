import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireAuthenticatedRoute } from "#lib/auth/route-auth";

export const Route = createFileRoute("/_app")({
  // The purchased Saas UI Pro shell is client-authored and its Resizer reads
  // browser globals while rendering. Keep the literal shell out of TanStack SSR.
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireAuthenticatedRoute({ auth: context.auth, location });
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
  // pendingComponent: AppLoader,
  component: () => {
    return <Outlet />;
  },
});
