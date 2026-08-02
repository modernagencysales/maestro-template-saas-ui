import { createFileRoute } from "@tanstack/react-router";

import { PublicReportShareRoute } from "../features/public-funnel/report/public-report-share-route";

export const Route = createFileRoute("/share/$token")({
  component: ShareRoute,
});

function ShareRoute() {
  const { token } = Route.useParams();
  return <PublicReportShareRoute token={token} />;
}
