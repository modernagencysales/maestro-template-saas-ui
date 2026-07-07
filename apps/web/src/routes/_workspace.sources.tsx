import { createFileRoute } from "@tanstack/react-router";
import { BusinessSectionRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/sources")({
  component: SourcesRoute,
});

function SourcesRoute() {
  return <BusinessSectionRoute section="sources" />;
}
