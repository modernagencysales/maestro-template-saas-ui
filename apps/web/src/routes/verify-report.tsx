import { createFileRoute } from "@tanstack/react-router";

import { ReportVerificationRoute } from "../features/public-funnel/report/report-verification-route";

export const Route = createFileRoute("/verify-report")({
  component: ReportVerificationRoute,
});
