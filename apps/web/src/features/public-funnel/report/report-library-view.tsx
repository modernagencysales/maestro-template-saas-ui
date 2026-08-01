import { PublicFunnelShell } from "../public-shell";
import { verdictLabels } from "./report-view";

export type LibraryReport = {
  readonly id: string;
  readonly ideaSummary?: string;
  readonly report: {
    readonly overallScore: number;
    readonly verdict: keyof typeof verdictLabels;
  };
};

export function ReportLibraryView({
  activeShareReportIds = [],
  onCreateShare,
  onRevokeShare,
  onDelete,
  reports,
  shareHrefByReportId = {},
  status = "ready",
}: {
  readonly activeShareReportIds?: readonly string[];
  readonly onCreateShare?: (reportId: string) => void;
  readonly onRevokeShare?: (reportId: string) => void;
  readonly onDelete?: (reportId: string) => void;
  readonly reports: readonly LibraryReport[];
  readonly shareHrefByReportId?: Readonly<Record<string, string>>;
  readonly status?: "loading" | "ready" | "unavailable";
}) {
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  return (
    <PublicFunnelShell>
      <main className="idea-report-library" id="main-content">
        <p className="idea-section-label">Saved reports</p>
        <h1>Your app ideas</h1>
        {status === "loading" ? (
          <section className="idea-empty-state" aria-busy="true">
            <h2>Loading your app ideas…</h2>
          </section>
        ) : null}
        {status === "unavailable" ? (
          <section className="idea-empty-state" role="alert">
            <h2>Your library is temporarily unavailable</h2>
            <p>
              Your saved reports are still safe. Refresh or try again shortly.
            </p>
          </section>
        ) : null}
        {status === "ready" && reports.length === 0 ? (
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
        ) : status === "ready" ? (
          <ul className="idea-report-list">
            {reports.map((evaluation) => (
              <li key={evaluation.id}>
                <article>
                  <p className="idea-section-label">
                    Score {evaluation.report.overallScore}/100
                  </p>
                  <h2>{verdictLabels[evaluation.report.verdict]}</h2>
                  <p>{evaluation.ideaSummary ?? "Verified app idea report"}</p>
                  <a href={`/report/${evaluation.id}`}>Open report</a>
                  {activeShareReportIds.includes(evaluation.id) ? (
                    <div className="idea-share-actions">
                      <a
                        href={
                          shareHrefByReportId[evaluation.id] ??
                          `/share/share_${evaluation.id}`
                        }
                      >
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
                  {deleteCandidate === evaluation.id ? (
                    <div className="idea-delete-confirmation" role="alert">
                      <p>
                        Delete this report and its private answers permanently?
                      </p>
                      <button
                        onClick={() => setDeleteCandidate(null)}
                        type="button"
                      >
                        Keep report
                      </button>
                      <button
                        onClick={() => {
                          onDelete?.(evaluation.id);
                          setDeleteCandidate(null);
                        }}
                        type="button"
                      >
                        Yes, delete report
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteCandidate(evaluation.id)}
                      type="button"
                    >
                      Delete report
                    </button>
                  )}
                </article>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </PublicFunnelShell>
  );
}
import { useState } from "react";
