import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/billing")({
  component: BillingRoute,
});

function BillingRoute() {
  return <BusinessSectionRoute section="billing" />;
}
