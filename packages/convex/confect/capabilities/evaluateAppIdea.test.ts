import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";

import {
  normalizeEvaluateAppIdeaInput,
  validateEvaluateAppIdeaInput,
} from "./evaluateAppIdea.domain";
import {
  evaluateAppIdeaArgs,
  evaluateAppIdeaWithModel,
} from "./evaluateAppIdea.spec";

const answers = {
  ideaSummary: "A useful app",
  customer: "Dental groups",
  problem: "Cancelled chair time",
  currentAlternative: "Manual phone calls",
  solution: "Automated waitlist matching",
  differentiation: "Matches treatment constraints",
  distributionEvidence: "Three pilot practices",
  founderContext: "Former operator",
};

describe("evaluateAppIdea capability domain", () => {
  it("exposes the anonymous evidence contract, not a workspace placeholder", () => {
    expect(() =>
      Schema.decodeUnknownSync(evaluateAppIdeaArgs)({
        sessionId: "session_1",
        accessToken: "token_1",
        answers,
      }),
    ).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(evaluateAppIdeaArgs, {
        onExcessProperty: "error",
      })({ workspaceSlug: "acme", input: "placeholder" }),
    ).toThrow();
  });

  it("normalizes anonymous credentials and answers", () => {
    expect(
      normalizeEvaluateAppIdeaInput({
        sessionId: " session_1 ",
        accessToken: " token_1 ",
        answers: { ...answers, customer: " Dental groups " },
      }),
    ).toMatchObject({
      sessionId: "session_1",
      accessToken: "token_1",
      answers: { customer: "Dental groups" },
    });
  });

  it("requires every evidence answer before evaluation", () => {
    expect(
      validateEvaluateAppIdeaInput({
        sessionId: "session_1",
        accessToken: "token_1",
        answers: { ...answers, distributionEvidence: "" },
      }),
    ).toContain("distributionEvidence must not be blank.");
  });

  it("runs provider-backed evaluation as an action", () => {
    expect(evaluateAppIdeaWithModel.runtimeAndFunctionType).toEqual({
      runtime: "Convex",
      functionType: "action",
    });
    expect(evaluateAppIdeaWithModel.functionVisibility).toBe("public");
  });
});
