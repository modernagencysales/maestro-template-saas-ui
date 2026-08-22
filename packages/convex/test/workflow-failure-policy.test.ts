import { describe, expect, it } from "vitest";

import { decodeWorkflowSettledFailure } from "../confect/workflows/_kit/failurePolicy";

describe("workflow settled failure decoding", () => {
  it("returns the typed public failure and rejects malformed input", () => {
    const failure = {
      _tag: "WorkflowSettledFailure",
      code: "PROVIDER_UNAVAILABLE",
      message: "Provider unavailable.",
    } as const;

    expect(decodeWorkflowSettledFailure(failure)).toEqual(failure);
    expect(
      decodeWorkflowSettledFailure({ ...failure, message: 42 }),
    ).toBeUndefined();
  });
});
