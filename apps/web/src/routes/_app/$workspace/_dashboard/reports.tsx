import { createFileRoute } from "@tanstack/react-router";

import { ReportsPage } from "#features/reports/reports-page.tsx";

export const Route = createFileRoute("/_app/$workspace/_dashboard/reports")({
  head: () => ({ meta: [{ title: "Reports" }] }),
  component: ReportsPage,
});
