import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/data-map")({
  component: DataMapRoute,
});

function DataMapRoute() {
  return <BusinessSectionRoute section="dataMap" />;
}
