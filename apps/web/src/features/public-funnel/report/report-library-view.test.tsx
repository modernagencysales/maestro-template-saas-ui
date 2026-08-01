import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";
import { ReportLibraryView } from "./report-library-view";
import { verdictLabels } from "./report-view";

describe("saved report library", () => {
  it("points an empty library toward the first evaluation", () => {
    const html = renderToStaticMarkup(<ReportLibraryView reports={[]} />);
    expect(html).toContain("No app ideas yet");
    expect(html).toContain("Roast my app idea");
  });

  it("shows saved verdicts with clear report destinations", () => {
    const evaluation = makeEvaluation(fixtureCompleteAnswers);
    const html = renderToStaticMarkup(
      <ReportLibraryView reports={[evaluation]} />,
    );
    expect(html).toContain(verdictLabels[evaluation.report.verdict]);
    expect(html).toContain(`/report/${evaluation.id}`);
    expect(html).toContain("Open report");
    expect(html).toContain("Create share link");
  });

  it("offers revocation for an active public snapshot", () => {
    const evaluation = makeEvaluation(fixtureCompleteAnswers);
    const html = renderToStaticMarkup(
      <ReportLibraryView
        activeShareReportIds={[evaluation.id]}
        reports={[evaluation]}
      />,
    );
    expect(html).toContain("Revoke share link");
  });
});
