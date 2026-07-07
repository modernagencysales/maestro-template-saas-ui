import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/api")({
  component: ApiRoute,
});

function ApiRoute() {
  return <BusinessSectionRoute section="api" />;
}
