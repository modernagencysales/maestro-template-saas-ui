import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/runs")({
  component: RunsRoute,
});

function RunsRoute() {
  return <BusinessSectionRoute section="runs" />;
}
