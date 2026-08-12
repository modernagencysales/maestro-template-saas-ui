import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "../features/golden/dashboard-page";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});
