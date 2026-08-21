import { createFileRoute } from "@tanstack/react-router";

import { KanbanDemo } from "#features/ui-lab/kanban-demo";

export const Route = createFileRoute("/_app/$workspace/_dashboard/kanban")({
  head: () => ({ meta: [{ title: "Kanban" }] }),
  component: KanbanDemo,
});
