import { describe, expect, it } from "vitest";

import { fixtureInput } from "./fixtures";
import {
  FreeAgentPolicyError,
  buildFreeAgentRequest,
  composeFreeAgentReport,
  decodeFreeAgentCompletion,
  runBoundedFreeAgent,
} from "./freeAgent";
import { buildFreeReport } from "./report";
import { scoreEvaluation } from "./rubric";

describe("cheap free evaluation agent", () => {
  it("builds one bounded request without research or tools", () => {
    const request = buildFreeAgentRequest(fixtureInput());
    expect(request.policy.tier).toBe("free");
    expect(request.policy.allowResearch).toBe(false);
    expect(request.maxCalls).toBe(1);
    expect(request.prompt).toContain("Tell me if this app idea is good");
    expect(request.prompt).toContain("constructive roast");
    expect(request.prompt).not.toContain("browse");
  });

  it("decodes only the public bounded JSON contract", () => {
    expect(
      decodeFreeAgentCompletion(
        JSON.stringify({
          roast: "A useful but blurry first pass.",
          improvedIdea: "A narrow workflow for dental groups.",
          strongestSignal: "Operator experience.",
          biggestRisk: "Distribution.",
          nextTest: "Interview five practices.",
        }),
      ),
    ).toMatchObject({ biggestRisk: "Distribution." });
    expect(() => decodeFreeAgentCompletion("not json")).toThrow();
  });

  it("fails closed before provider transport when the free budget is spent", async () => {
    let calls = 0;
    await expect(
      runBoundedFreeAgent({
        input: fixtureInput(),
        usage: {
          callsUsed: 5,
          inputTokensUsed: 0,
          outputTokensUsed: 0,
          repairAttemptsUsed: 0,
          spentCents: 0,
        },
        complete: async () => {
          calls += 1;
          throw new Error("must not run");
        },
      }),
    ).rejects.toBeInstanceOf(FreeAgentPolicyError);
    expect(calls).toBe(0);
  });

  it("repairs malformed structured output once and records cumulative usage", async () => {
    const completions = [
      { text: "not json", inputTokens: 100, outputTokens: 20, spentCents: 1 },
      {
        text: JSON.stringify({
          roast: "A useful but blurry first pass.",
          improvedIdea: "A narrow workflow for dental groups.",
          strongestSignal: "Operator experience.",
          biggestRisk: "Distribution.",
          nextTest: "Interview five practices.",
        }),
        inputTokens: 80,
        outputTokens: 40,
        spentCents: 1,
      },
    ];
    const result = await runBoundedFreeAgent({
      input: fixtureInput(),
      complete: async () =>
        completions.shift() ??
        Promise.reject(new Error("The completion fixture was exhausted.")),
    });
    expect(result.output.biggestRisk).toBe("Distribution.");
    expect(result.usage).toMatchObject({
      callsUsed: 2,
      inputTokensUsed: 180,
      outputTokensUsed: 60,
      repairAttemptsUsed: 1,
      spentCents: 2,
    });
    const report = composeFreeAgentReport(
      buildFreeReport(scoreEvaluation(fixtureInput())),
      result.output,
    );
    expect(report.roast).toBe("A useful but blurry first pass.");
    expect(report.whatItWillTake[0]).toBe("Interview five practices.");
  });
});
