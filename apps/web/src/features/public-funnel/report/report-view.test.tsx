import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";
import { EvaluationReportView } from "./report-view";
import { downloadReport, reportAsMarkdown } from "./report-export";

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

  it("downloads the same useful report as Markdown", () => {
    const evaluation = makeEvaluation(fixtureCompleteAnswers);
    const click = vi.fn();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", {
      createElement: () => ({ href: "", download: "", click }),
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:report",
      revokeObjectURL,
    });
    try {
      expect(reportAsMarkdown(evaluation)).toContain("What it will take");
      downloadReport(evaluation);
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
