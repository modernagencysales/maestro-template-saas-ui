import { createFileRoute } from "@tanstack/react-router";
import { GoldenKanbanPage } from "../features/golden/kanban-page";

export const Route = createFileRoute("/_workspace/kanban")({
  component: GoldenKanbanPage,
});
