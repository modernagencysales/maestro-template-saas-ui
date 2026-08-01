import { useEffect, useState } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import type { BuildabilityReport } from "@maestro-template/app-idea-evaluator";

import { useTemplateQuery } from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import { loadEvaluation } from "../evaluation-storage";
import type { StoredEvaluation } from "../intake/evaluation-adapter";
import { PublicFunnelShell } from "../public-shell";
import { EvaluationReportView } from "./report-view";
import { ReportOwnershipCard } from "./report-ownership-card";
import { ReportRevisionCard } from "./report-revision-card";
import {
  loadAnonymousReportAccess,
  loadOwnerAccessToken,
} from "./report-credentials";

export function EvaluationReportRoute({ id }: { readonly id: string }) {
  return isConvexConfigured() ? (
    <ConfiguredEvaluationReportRoute id={id} />
  ) : (
    <BrowserEvaluationReportRoute id={id} />
  );
}

function BrowserEvaluationReportRoute({ id }: { readonly id: string }) {
  const [evaluation, setEvaluation] = useState<StoredEvaluation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [access] = useState(() => loadAnonymousReportAccess(id));

  useEffect(() => {
    setEvaluation(loadEvaluation(id));
    setLoaded(true);
  }, [id]);

  if (!loaded) {
    return (
      <PublicFunnelShell>
        <main className="idea-loading" id="main-content" aria-busy="true">
          <p>Loading your report…</p>
        </main>
      </PublicFunnelShell>
    );
  }
  if (!evaluation) {
    return (
      <PublicFunnelShell>
        <main className="idea-information" id="main-content">
          <h1>Report not found</h1>
          <p>This report is not saved in this browser.</p>
          <a className="idea-primary-action" href="/evaluate">
            Evaluate an app idea
          </a>
        </main>
      </PublicFunnelShell>
    );
  }
  return (
    <EvaluationReportView
      evaluation={evaluation}
      ownership={
        access !== null ? (
          <ReportOwnershipCard accessToken={access.accessToken} reportId={id} />
        ) : undefined
      }
    />
  );
}

function ConfiguredEvaluationReportRoute({ id }: { readonly id: string }) {
  const [evaluation, setEvaluation] = useState<StoredEvaluation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [access] = useState(() => loadAnonymousReportAccess(id));
  const [ownerAccessToken] = useState(loadOwnerAccessToken);
  const liveEnabled = isConvexConfigured();
  const liveReport = useTemplateQuery(
    templateConfectRefs.public.capabilities.manageEvaluationReport
      .getEvaluationReport,
    liveEnabled && (access !== null || ownerAccessToken !== null)
      ? {
          reportId: id,
          ...(access === null ? {} : { accessToken: access.accessToken }),
          ...(ownerAccessToken === null ? {} : { ownerAccessToken }),
        }
      : "skip",
  );

  useEffect(() => {
    setEvaluation(loadEvaluation(id));
    setLoaded(true);
  }, [id]);

  if (!loaded || (liveEnabled && liveReport.status === "loading")) {
    return (
      <PublicFunnelShell>
        <main className="idea-loading" id="main-content" aria-busy="true">
          <p>Loading your report…</p>
        </main>
      </PublicFunnelShell>
    );
  }
  if (liveEnabled && liveReport.status === "ready") {
    try {
      const report = JSON.parse(
        liveReport.data.reportJson,
      ) as BuildabilityReport;
      return (
        <EvaluationReportView
          evaluation={{ id, report }}
          ownership={
            access !== null || ownerAccessToken !== null ? (
              <>
                {access === null ? null : (
                  <ReportOwnershipCard
                    accessToken={access.accessToken}
                    reportId={id}
                  />
                )}
                {ownerAccessToken === null ? null : (
                  <ReportRevisionCard
                    ownerAccessToken={ownerAccessToken}
                    reportId={id}
                  />
                )}
              </>
            ) : undefined
          }
        />
      );
    } catch {
      return (
        <PublicFunnelShell>
          <main className="idea-information" id="main-content" role="alert">
            <h1>Report unavailable</h1>
            <p>The saved report could not be read. Contact support for help.</p>
          </main>
        </PublicFunnelShell>
      );
    }
  }
  if (
    liveEnabled &&
    liveReport.status !== "skipped" &&
    liveReport.status !== "loading"
  ) {
    return (
      <PublicFunnelShell>
        <main className="idea-information" id="main-content" role="alert">
          <h1>Report access unavailable</h1>
          <p>
            Use the browser where you started, or verify your email to continue.
          </p>
        </main>
      </PublicFunnelShell>
    );
  }
  if (!evaluation) {
    return (
      <PublicFunnelShell>
        <main className="idea-information" id="main-content">
          <h1>Report not found</h1>
          <p>This report is not saved in this browser.</p>
          <a className="idea-primary-action" href="/evaluate">
            Evaluate an app idea
          </a>
        </main>
      </PublicFunnelShell>
    );
  }
  return (
    <EvaluationReportView
      evaluation={evaluation}
      ownership={
        access !== null ? (
          <ReportOwnershipCard accessToken={access.accessToken} reportId={id} />
        ) : undefined
      }
    />
  );
}
