import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppLayout } from "../features/common/layouts/app-layout";
import { DashboardLayout } from "../features/common/layouts/dashboard-layout";

export const Route = createFileRoute("/_workspace")({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return (
    <AppLayout>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    </AppLayout>
  );
}
