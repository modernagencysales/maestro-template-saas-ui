import { createFileRoute } from "@tanstack/react-router";
import { BusinessSettingsRoute } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/settings")({
  component: BusinessSettingsRoute,
});
