import { createFileRoute } from "@tanstack/react-router";
import { BusinessDataLifecycleRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/data-lifecycle")({
  component: DataLifecycleRoute,
});

function DataLifecycleRoute() {
  return <BusinessDataLifecycleRoute />;
}
