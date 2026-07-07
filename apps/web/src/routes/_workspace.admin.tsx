import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/admin")({
  component: AdminRoute,
});

function AdminRoute() {
  return <BusinessSectionRoute section="admin" />;
}
