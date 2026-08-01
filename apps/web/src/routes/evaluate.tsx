import { createFileRoute } from "@tanstack/react-router";

import { AppIdeaIntake } from "../features/public-funnel/intake/intake-view";

export const Route = createFileRoute("/evaluate")({ component: EvaluateRoute });

function EvaluateRoute() {
  const navigate = Route.useNavigate();
  return (
    <AppIdeaIntake
      onReportReady={(evaluationId) => {
        void navigate({
          to: "/report/$evaluationId",
          params: { evaluationId },
        });
      }}
    />
  );
}
