import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuildPackProgress, CompleteBuildPackView } from "./build-pack-view";

describe("Complete Build Pack experience", () => {
  it("shows completed stages while a later stage retries", () => {
    const html = renderToStaticMarkup(
      <BuildPackProgress
        packId="pack_1"
        stages={[
          { name: "normalize", status: "completed", attempts: 1 },
          { name: "challenge", status: "completed", attempts: 1 },
          { name: "research", status: "failed-recoverable", attempts: 1 },
        ]}
      />,
    );

    expect(html).toContain("Product brief complete");
    expect(html).toContain("Retry market research");
  });

  it("renders canonical build sections without another model call", () => {
    const html = renderToStaticMarkup(
      <CompleteBuildPackView
        pack={{
          productBrief: "A focused brief",
          customerAndProblem: "A specific customer and painful problem",
          scope: ["First capability"],
          requirements: ["The product must work"],
          userJourneys: ["Founder completes a task"],
          dataModel: ["Account"],
          architecture: "A durable architecture",
          integrations: [],
          securityAndPrivacy: ["Keep ideas private"],
          deliveryPlan: ["Phase one"],
          acceptanceCriteria: ["The journey passes"],
          risks: ["Distribution"],
          openQuestions: [],
          competitorClaims: [],
        }}
        packId="pack_1"
      />,
    );

    expect(html).toContain("Product brief");
    expect(html).toContain("Requirements");
    expect(html).toContain("Delivery plan");
    expect(html).toContain("Download Build Pack");
    expect(html).toContain("Download print-ready HTML");
    expect(html).toContain("See how Maestro could build this");
    expect(html).toContain("/maestro/pack_1");
  });
});
