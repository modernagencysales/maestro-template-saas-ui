import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "../features/reports/reports-page";

export const Route = createFileRoute("/_workspace/_dashboard/reports")({
  component: ReportsPage,
});
