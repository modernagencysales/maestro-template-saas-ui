import { PublicFunnelShell } from "../public-shell";
import type { PublicReportShare } from "./report-library";
import { verdictLabels } from "./report-view";

export function PublicReportShareView({
  share,
}: {
  readonly share: PublicReportShare | null;
}) {
  if (!share) {
    return (
      <PublicFunnelShell>
        <main className="idea-information" id="main-content">
          <h1>This shared report is unavailable</h1>
          <p>The link may have been revoked by its owner.</p>
          <a className="idea-primary-action" href="/evaluate">
            Evaluate your own app idea
          </a>
        </main>
      </PublicFunnelShell>
    );
  }
  const { snapshot } = share;
  return (
    <PublicFunnelShell>
      <main className="idea-report" id="main-content">
        <header className="idea-report-header">
          <div>
            <p className="idea-section-label">Shared Buildability Report</p>
            <h1>{verdictLabels[snapshot.verdict]}</h1>
            <p>{snapshot.roast}</p>
          </div>
          <div
            className="idea-report-score"
            aria-label={`Score: ${String(snapshot.overallScore)} out of 100`}
          >
            <strong>{snapshot.overallScore}</strong>
            <span>/100</span>
          </div>
        </header>
        <div className="idea-report-grid">
          <section>
            <p className="idea-section-label">Strongest signal</p>
            <h2>{snapshot.strongestElement}</h2>
          </section>
          <section>
            <p className="idea-section-label">Biggest risk</p>
            <h2>{snapshot.biggestWeakness}</h2>
          </section>
        </div>
        <section className="idea-report-section">
          <p className="idea-section-label">A stronger version</p>
          <h2>{snapshot.improvedIdea}</h2>
        </section>
        <a className="idea-primary-action" href="/evaluate">
          Roast my app idea
        </a>
      </main>
    </PublicFunnelShell>
  );
}
