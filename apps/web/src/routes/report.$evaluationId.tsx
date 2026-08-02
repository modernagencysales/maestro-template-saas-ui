import { createFileRoute } from "@tanstack/react-router";

import { EvaluationReportRoute } from "../features/public-funnel/report/report-route";

export const Route = createFileRoute("/report/$evaluationId")({
  component: ReportRoute,
});

function ReportRoute() {
  const { evaluationId } = Route.useParams();
  return <EvaluationReportRoute id={evaluationId} />;
}
