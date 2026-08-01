import { ArrowRight, Check, Download, RotateCcw } from "lucide-react";

import type { StoredEvaluation } from "../intake/evaluation-adapter";
import { PublicFunnelShell } from "../public-shell";
import { downloadReport } from "./report-export";

export const verdictLabels = {
  "too-expensive-for-version-one": "Too expensive for version one",
  "strong-problem-weak-solution": "Strong problem. Weak solution.",
  "good-product-unclear-distribution": "Good product. Unclear distribution.",
  "needs-a-different-customer": "The idea needs a different customer",
  "worth-testing": "Worth testing",
  "promising-but-blurry": "Promising, but still blurry",
} as const;

export function EvaluationReportView({
  evaluation,
}: {
  readonly evaluation: StoredEvaluation;
}) {
  const { report } = evaluation;
  return (
    <PublicFunnelShell>
      <main className="idea-report" id="main-content">
        <header className="idea-report-header">
          <div>
            <p className="idea-section-label">Your app idea verdict</p>
            <h1>{verdictLabels[report.verdict]}</h1>
            <p>{report.roast}</p>
          </div>
          <div
            className="idea-report-score"
            aria-label={`Score: ${String(report.overallScore)} out of 100`}
          >
            <strong>{report.overallScore}</strong>
            <span>/100</span>
          </div>
        </header>

        <div className="idea-report-grid">
          <section>
            <p className="idea-section-label">What is working</p>
            <h2>{report.strongestElement}</h2>
          </section>
          <section>
            <p className="idea-section-label">The uncomfortable bit</p>
            <h2>{report.biggestWeakness}</h2>
          </section>
        </div>

        <section className="idea-report-section">
          <p className="idea-section-label">A stronger version</p>
          <h2>{report.improvedIdea}</h2>
        </section>

        <section className="idea-report-section">
          <p className="idea-section-label">Know what it will take</p>
          <h2>What it will take</h2>
          <ol className="idea-take-list">
            {report.whatItWillTake.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="idea-build-pack-offer">
          <div>
            <p className="idea-section-label">Exclusive: Complete Build Pack</p>
            <h2>Know exactly how to build it.</h2>
            <p>
              Turn this evaluation into a practical specification you can hand
              to a developer, agency, or coding agent—with enough clarity to
              estimate, build, and review the work.
            </p>
            <ul>
              {report.exclusiveInCompleteBuildPack.map((item) => (
                <li key={item}>
                  <Check aria-hidden="true" size={17} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <a
            className="idea-primary-action"
            href={`/checkout/${evaluation.id}`}
          >
            Get the Complete Build Pack
            <ArrowRight aria-hidden="true" size={18} />
          </a>
        </section>

        <div className="idea-report-actions">
          <button onClick={() => downloadReport(evaluation)} type="button">
            <Download aria-hidden="true" size={17} />
            Download report
          </button>
          <a href="/evaluate">
            <RotateCcw aria-hidden="true" size={17} />
            Evaluate another idea
          </a>
        </div>
      </main>
    </PublicFunnelShell>
  );
}
