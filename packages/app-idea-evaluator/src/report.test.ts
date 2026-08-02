import { describe, expect, it } from "vitest";

import { fixtureInput } from "./fixtures";
import { buildFreeReport } from "./report";
import { decodeBuildabilityReport } from "./schemas";
import { scoreEvaluation } from "./rubric";

describe("buildFreeReport", () => {
  it("rejects malformed or privately extended report documents", () => {
    expect(() =>
      decodeBuildabilityReport({
        ...buildFreeReport(scoreEvaluation(fixtureInput())),
        privateAnswers: ["secret"],
      }),
    ).toThrow();
  });
  it("gives the verdict away and explains what it will take", () => {
    const report = buildFreeReport(scoreEvaluation(fixtureInput()));

    expect(report.verdict).toBeDefined();
    expect(report.roast.length).toBeGreaterThan(20);
    expect(report.strongestElement).not.toBe("");
    expect(report.biggestWeakness).not.toBe("");
    expect(report.improvedIdea).toContain("ChairFill");
    expect(report.whatItWillTake.length).toBeGreaterThanOrEqual(3);
  });

  it("labels premium material without blurring the free report", () => {
    const report = buildFreeReport(scoreEvaluation(fixtureInput()));

    expect(report.exclusiveInCompleteBuildPack).toContain(
      "Technical specification",
    );
    expect(report.overallScore).toBeGreaterThan(0);
  });
});
