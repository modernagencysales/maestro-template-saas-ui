import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/capabilities")({
  component: CapabilitiesRoute,
});

function CapabilitiesRoute() {
  return <BusinessSectionRoute section="capabilities" />;
}
