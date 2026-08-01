import { describe, expect, it } from "vitest";

import { parseCanonicalBuildPack } from "./build-pack-ready-route";

describe("configured canonical Build Pack read", () => {
  it("decodes the server-owned canonical artifact", () => {
    expect(
      parseCanonicalBuildPack(
        JSON.stringify({
          productBrief: "Brief",
          customerAndProblem: "Customer problem",
          scope: ["Scope"],
          requirements: ["Requirement"],
          userJourneys: ["Journey"],
          dataModel: ["Entity"],
          architecture: "Architecture",
          integrations: [],
          securityAndPrivacy: ["Control"],
          deliveryPlan: ["Phase"],
          acceptanceCriteria: ["Criterion"],
          risks: ["Risk"],
          openQuestions: [],
          competitorClaims: [],
        }),
      ).productBrief,
    ).toBe("Brief");
  });

  it("rejects malformed or prompt-leaking artifacts", () => {
    expect(() => parseCanonicalBuildPack("not-json")).toThrow();
    expect(() =>
      parseCanonicalBuildPack(
        JSON.stringify({ productBrief: "Brief", hiddenPrompt: "secret" }),
      ),
    ).toThrow();
  });
});
