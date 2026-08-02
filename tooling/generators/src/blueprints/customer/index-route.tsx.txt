import { createFileRoute } from "@tanstack/react-router";

import { BusinessDashboardRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/")({
  component: BusinessDashboardRoute,
});
