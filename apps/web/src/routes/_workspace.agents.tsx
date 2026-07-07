import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/agents")({
  component: AgentsRoute,
});

function AgentsRoute() {
  return <BusinessSectionRoute section="agents" />;
}
