import { createFileRoute } from "@tanstack/react-router";

import { ReportLibraryRoute } from "../features/public-funnel/report/report-library-route";

export const Route = createFileRoute("/library")({
  component: ReportLibraryRoute,
});
