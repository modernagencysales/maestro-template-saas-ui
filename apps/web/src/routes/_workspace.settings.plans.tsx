import { createFileRoute } from "@tanstack/react-router";

import { PlansPage } from "../features/settings/billing/plans-page";

export const Route = createFileRoute("/_workspace/settings/plans")({
  component: PlansPage,
});
