import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/workflows")({
  component: WorkflowsRoute,
});

function WorkflowsRoute() {
  return <BusinessSectionRoute section="workflows" />;
}
