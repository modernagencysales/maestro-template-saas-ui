import { useEffect, useState } from "react";

import { loadEvaluation } from "../evaluation-storage";
import type { StoredEvaluation } from "../intake/evaluation-adapter";
import { PublicFunnelShell } from "../public-shell";
import { EvaluationReportView } from "./report-view";

export function EvaluationReportRoute({ id }: { readonly id: string }) {
  const [evaluation, setEvaluation] = useState<StoredEvaluation | null>(null);
  const [loaded, setLoaded] = useState(false);

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
  return <EvaluationReportView evaluation={evaluation} />;
}
