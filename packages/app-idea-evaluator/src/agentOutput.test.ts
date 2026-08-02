import { describe, expect, it } from "vitest";

import { decodeFreeAgentOutput } from "./agentOutput";

describe("free evaluator agent output", () => {
  it("decodes a bounded constructive evaluation", () => {
    expect(
      decodeFreeAgentOutput({
        roast: "You have described a feature, but not yet a buying trigger.",
        improvedIdea: "A cancellation recovery tool for dental groups.",
        strongestSignal: "The founder knows the operating workflow.",
        biggestRisk: "The distribution path is still anecdotal.",
        nextTest: "Ask five practices what a filled chair is worth.",
      }),
    ).toMatchObject({
      biggestRisk: "The distribution path is still anecdotal.",
    });
  });

  it("rejects extra research or hidden prompt content", () => {
    expect(() =>
      decodeFreeAgentOutput({
        roast: "Useful roast",
        improvedIdea: "Better idea",
        strongestSignal: "Signal",
        biggestRisk: "Risk",
        nextTest: "Test",
        competitorResearch: ["Uncited claim"],
      }),
    ).toThrow();
  });

  it("rejects oversized output before persistence", () => {
    expect(() =>
      decodeFreeAgentOutput({
        roast: "x".repeat(1_501),
        improvedIdea: "Better idea",
        strongestSignal: "Signal",
        biggestRisk: "Risk",
        nextTest: "Test",
      }),
    ).toThrow();
  });
});
