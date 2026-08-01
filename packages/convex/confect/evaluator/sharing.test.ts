import { describe, expect, it } from "vitest";

import { createPublicEvaluationReportSnapshot } from "./sharing";

describe("public evaluation report snapshots", () => {
  it("projects only explicitly public report fields", () => {
    const snapshot = createPublicEvaluationReportSnapshot(
      "report_1",
      JSON.stringify({
        verdict: "worth-testing",
        overallScore: 72,
        roast: "Specific problem, vague acquisition.",
        strongestElement: "A painful workflow",
        biggestWeakness: "No repeatable distribution",
        improvedIdea: "Start with one clinic group.",
        answers: ["private answer"],
        email: "founder@example.test",
        prompt: "private prompt",
        modelOutput: "private output",
        paymentId: "pay_secret",
      }),
    );
    const json = JSON.stringify(snapshot);
    for (const secret of [
      "private answer",
      "founder@example.test",
      "private prompt",
      "private output",
      "pay_secret",
    ])
      expect(json).not.toContain(secret);
  });
});
