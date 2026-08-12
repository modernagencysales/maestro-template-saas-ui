import { createFileRoute, Outlet } from "@tanstack/react-router";

import { DashboardLayout } from "../features/common/layouts/dashboard-layout";

export const Route = createFileRoute("/_workspace/_dashboard")({
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
