import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/brain")({
  component: BrainRoute,
});

function BrainRoute() {
  return <BusinessSectionRoute section="brain" />;
}
