import { createFileRoute } from "@tanstack/react-router";

import { WorkflowsPage } from "#features/workflows/workflows-page.tsx";

export const Route = createFileRoute("/_app/$workspace/_dashboard/workflows")({
  head: () => ({ meta: [{ title: "Workflows" }] }),
  component: WorkflowsPage,
});
