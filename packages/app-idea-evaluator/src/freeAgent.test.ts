import { describe, expect, it } from "vitest";

import { fixtureInput } from "./fixtures";
import { buildFreeAgentRequest, decodeFreeAgentCompletion } from "./freeAgent";

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
});
