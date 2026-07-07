import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/health")({
  component: HealthRoute,
});

function HealthRoute() {
  return <BusinessSectionRoute section="health" />;
}
