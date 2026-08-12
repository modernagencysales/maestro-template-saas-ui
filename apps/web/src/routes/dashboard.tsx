import { createFileRoute } from "@tanstack/react-router";

import { DashboardLayout } from "../features/common/layouts/dashboard-layout";
import { DashboardPage } from "../features/golden/dashboard-page";

export const Route = createFileRoute("/dashboard")({
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <DashboardLayout>
      <DashboardPage />
    </DashboardLayout>
  );
}
