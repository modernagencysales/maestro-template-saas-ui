import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "../features/reports/reports-page";

export const Route = createFileRoute("/_workspace/reports")({
  component: ReportsPage,
});
