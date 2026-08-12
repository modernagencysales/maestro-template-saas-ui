import { createFileRoute, Outlet } from "@tanstack/react-router";

import { BillingProvider } from "../features/billing/providers/billing-provider";

export const Route = createFileRoute("/_workspace")({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return (
    <BillingProvider>
      <Outlet />
    </BillingProvider>
  );
}
