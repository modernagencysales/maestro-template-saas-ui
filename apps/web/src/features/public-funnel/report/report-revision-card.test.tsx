import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReportRevisionSurface } from "./report-revision-card";

describe("report revision surface", () => {
  it("asks for the new evidence or change in plain language", () => {
    const html = renderToStaticMarkup(
      <ReportRevisionSurface
        feedback=""
        onFeedbackChange={() => undefined}
        onSubmit={() => undefined}
        state={{ _tag: "idle" }}
        versionCount={1}
      />,
    );
    expect(html).toContain("What changed about your idea?");
    expect(html).toContain("Generate revised report");
    expect(html).toContain("Version 1 is saved");
    expect(html).toContain('name="revision-feedback"');
  });

  it("explains that a failed revision did not damage the report", () => {
    const html = renderToStaticMarkup(
      <ReportRevisionSurface
        feedback="New customer evidence"
        onFeedbackChange={() => undefined}
        onSubmit={() => undefined}
        state={{ _tag: "error" }}
        versionCount={1}
      />,
    );
    expect(html).toContain("Your current report is unchanged");
    expect(html).toContain('role="alert"');
  });

  it("announces the appended version", () => {
    const html = renderToStaticMarkup(
      <ReportRevisionSurface
        feedback="New customer evidence"
        onFeedbackChange={() => undefined}
        onSubmit={() => undefined}
        state={{ _tag: "revised", version: 2 }}
        versionCount={2}
      />,
    );
    expect(html).toContain("Version 2 is ready");
    expect(html).toContain('role="status"');
  });
});
