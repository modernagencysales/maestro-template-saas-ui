import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/analytics")({
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  return <BusinessSectionRoute section="analytics" />;
}
