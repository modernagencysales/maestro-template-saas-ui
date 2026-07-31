import { describe, expect, it } from "vitest";
import {
  calculateLlmSpend,
  estimateConservativeTokenCount,
  SpendCapExceededError,
  verifyDailySpendCap,
} from "./spend";

describe("LLM spend estimator", () => {
  it("estimates tokens conservatively from short and long text", () => {
    expect(estimateConservativeTokenCount("hello world")).toBe(3);
    expect(estimateConservativeTokenCount("")).toBe(1);
    expect(
      estimateConservativeTokenCount("x".repeat(1000)),
    ).toBeGreaterThanOrEqual(250);
  });

  it("applies a cents floor for tiny model calls", () => {
    expect(
      calculateLlmSpend({
        promptTokens: 1,
        completionTokens: 1,
        inputCentsPerMillionTokens: 10,
        outputCentsPerMillionTokens: 20,
        minimumCents: 1,
      }),
    ).toEqual({
      promptTokens: 1,
      completionTokens: 1,
      estimatedCents: 1,
    });
  });

  it("prices a request from request-scoped rates without rounding away sub-cent costs", () => {
    expect(
      calculateLlmSpend({
        promptTokens: 1_000,
        completionTokens: 500,
        inputCentsPerMillionTokens: 10,
        outputCentsPerMillionTokens: 40,
        minimumCents: 0,
      }),
    ).toMatchObject({ estimatedCents: 0.03 });
  });

  it("denies calls that would exceed the daily cap", () => {
    const denial = verifyDailySpendCap({
      workspaceSlug: "acme-demo",
      currentDailySpendCents: 990,
      estimatedCallCents: 15,
      dailySpendLimitCents: 1000,
    });

    expect(denial).toBeInstanceOf(SpendCapExceededError);
    expect(denial).toMatchObject({
      _tag: "SpendCapExceededError",
      workspaceSlug: "acme-demo",
      currentDailySpendCents: 990,
      estimatedCallCents: 15,
      dailySpendLimitCents: 1000,
    });
  });
});
