import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppLayout } from "../features/common/layouts/app-layout";
import { BillingProvider } from "../features/billing/providers/billing-provider";
import { DashboardLayout } from "../features/common/layouts/dashboard-layout";

export const Route = createFileRoute("/_workspace")({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return (
    <BillingProvider>
      <AppLayout>
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </AppLayout>
    </BillingProvider>
  );
}
