import type { StoredEvaluation } from "../intake/evaluation-adapter";
import { PublicFunnelShell } from "../public-shell";
import { verdictLabels } from "./report-view";

export function ReportLibraryView({
  activeShareReportIds = [],
  onCreateShare,
  onRevokeShare,
  reports,
}: {
  readonly activeShareReportIds?: readonly string[];
  readonly onCreateShare?: (reportId: string) => void;
  readonly onRevokeShare?: (reportId: string) => void;
  readonly reports: readonly StoredEvaluation[];
}) {
  return (
    <PublicFunnelShell>
      <main className="idea-report-library" id="main-content">
        <p className="idea-section-label">Saved reports</p>
        <h1>Your app ideas</h1>
        {reports.length === 0 ? (
          <section className="idea-empty-state">
            <h2>No app ideas yet</h2>
            <p>
              Get a clear verdict, a constructive roast, and what it will take
              to build your first idea.
            </p>
            <a className="idea-primary-action" href="/evaluate">
              Roast my app idea
            </a>
          </section>
        ) : (
          <ul className="idea-report-list">
            {reports.map((evaluation) => (
              <li key={evaluation.id}>
                <article>
                  <p className="idea-section-label">
                    Score {evaluation.report.overallScore}/100
                  </p>
                  <h2>{verdictLabels[evaluation.report.verdict]}</h2>
                  <p>{evaluation.answers.ideaSummary}</p>
                  <a href={`/report/${evaluation.id}`}>Open report</a>
                  {activeShareReportIds.includes(evaluation.id) ? (
                    <div className="idea-share-actions">
                      <a href={`/share/share_${evaluation.id}`}>
                        Open share link
                      </a>
                      <button
                        onClick={() => onRevokeShare?.(evaluation.id)}
                        type="button"
                      >
                        Revoke share link
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onCreateShare?.(evaluation.id)}
                      type="button"
                    >
                      Create share link
                    </button>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PublicFunnelShell>
  );
}
