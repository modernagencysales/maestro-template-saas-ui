import { describe, expect, it } from "vitest";

import {
  FREE_MODEL_POLICY,
  PREMIUM_MODEL_POLICY,
  authorizeFreeEvaluationStart,
  authorizeModelCall,
} from "./modelPolicy";

describe("tiered model policy", () => {
  it("caps a free evaluation before provider transport", () => {
    expect(
      authorizeModelCall(FREE_MODEL_POLICY, {
        callsUsed: FREE_MODEL_POLICY.maxCalls,
        inputTokensUsed: 100,
        outputTokensUsed: 20,
        repairAttemptsUsed: 0,
        spentCents: 0,
      }),
    ).toEqual({ allowed: false, reason: "call-limit" });
  });

  it("keeps research out of the free agent", () => {
    expect(FREE_MODEL_POLICY.allowResearch).toBe(false);
    expect(PREMIUM_MODEL_POLICY.allowResearch).toBe(true);
    expect(PREMIUM_MODEL_POLICY.maxOutputTokens).toBeGreaterThan(
      FREE_MODEL_POLICY.maxOutputTokens,
    );
  });

  it("limits anonymous and verified-email free evaluation allowances", () => {
    expect(authorizeFreeEvaluationStart({ sessionEvaluations: 1 })).toEqual({
      allowed: false,
      reason: "session-limit",
    });
    expect(
      authorizeFreeEvaluationStart({
        sessionEvaluations: 0,
        verifiedEmailEvaluations: 3,
      }),
    ).toEqual({ allowed: false, reason: "email-limit" });
  });

  it.each([
    ["input-token-limit", { inputTokensUsed: 12_000 }],
    ["output-token-limit", { outputTokensUsed: 3_000 }],
    ["repair-limit", { repairAttemptsUsed: 1 }],
    ["evaluation-spend-limit", { spentCents: 15 }],
  ] as const)("rejects free usage at the %s", (reason, override) => {
    expect(
      authorizeModelCall(FREE_MODEL_POLICY, {
        callsUsed: 0,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        repairAttemptsUsed: 0,
        spentCents: 0,
        ...override,
      }),
    ).toEqual({ allowed: false, reason });
  });
});
