import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";
import { EvaluationReportView } from "./report-view";

describe("free Buildability Report", () => {
  it("shows the unblurred verdict and paid boundary", () => {
    const evaluation = makeEvaluation(
      fixtureCompleteAnswers,
      "2026-07-31T00:00:00.000Z",
    );
    const html = renderToStaticMarkup(
      <EvaluationReportView evaluation={evaluation} />,
    );

    expect(html).toContain("Your app idea verdict");
    expect(html).toContain("What it will take");
    expect(html).toContain("Complete Build Pack");
    expect(html).not.toContain("blur(");
  });

  it("offers a developer-ready export path", () => {
    const evaluation = makeEvaluation(fixtureCompleteAnswers);
    const html = renderToStaticMarkup(
      <EvaluationReportView evaluation={evaluation} />,
    );

    expect(html).toContain("Download report");
    expect(html).toContain("developer, agency, or coding agent");
  });
});
