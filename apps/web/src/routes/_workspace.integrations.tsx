import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/integrations")({
  component: IntegrationsRoute,
});

function IntegrationsRoute() {
  return <BusinessSectionRoute section="integrations" />;
}
