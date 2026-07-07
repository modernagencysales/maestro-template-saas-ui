import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/legal")({
  component: LegalRoute,
});

function LegalRoute() {
  return <BusinessSectionRoute section="legal" />;
}
