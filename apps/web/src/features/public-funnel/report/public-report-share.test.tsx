import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicReportShareView } from "./public-report-share";

describe("public report snapshot", () => {
  it("shows the useful verdict without private answers", () => {
    const html = renderToStaticMarkup(
      <PublicReportShareView
        share={{
          token: "share_1",
          status: "active",
          snapshot: {
            reportId: "idea_1",
            verdict: "worth-testing",
            overallScore: 78,
            roast: "A constructive roast",
            strongestElement: "A clear customer",
            biggestWeakness: "Distribution",
            improvedIdea: "A narrower version",
          },
        }}
      />,
    );
    expect(html).toContain("Worth testing");
    expect(html).toContain("A constructive roast");
    expect(html).toContain("Shared Buildability Report");
  });

  it("shows a safe unavailable state after revocation", () => {
    const html = renderToStaticMarkup(<PublicReportShareView share={null} />);
    expect(html).toContain("This shared report is unavailable");
  });
});
