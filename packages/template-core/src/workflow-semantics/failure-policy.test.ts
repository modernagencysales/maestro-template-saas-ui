import * as Either from "effect/Either";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import {
  makeWorkflowFailurePolicySchema,
  validateDeclaredWorkflowFailureRouting,
} from "./failure-policy";

const WorkflowCapabilityReference = Schema.NonEmptyString.pipe(
  Schema.pattern(/^capability\.[a-z][A-Za-z0-9]*\.v[1-9]\d*$/),
  Schema.brand("WorkflowCapabilityReference"),
);
const WorkflowStepName = Schema.NonEmptyString.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*\.v[1-9]\d*$/),
);
const FailurePolicy = makeWorkflowFailurePolicySchema({
  WorkflowCapabilityReference,
  WorkflowStepName,
});
const decode = Schema.decodeUnknownEither(FailurePolicy, {
  errors: "all",
  onExcessProperty: "error",
});
const failure = {
  _tag: "WorkflowSettledFailure",
  code: "PROVIDER_REJECTED",
  message: "Provider rejected the request.",
} as const;

describe("workflow failure policy semantic authority", () => {
  it.each([
    { kind: "fail" },
    { kind: "error-edge", edgeId: "charge-error", failure },
    {
      kind: "compensation",
      edgeId: "charge-compensated",
      capability: "capability.reverseCharge.v2",
      stepName: "reverse-charge.v2",
      failure,
    },
  ])("accepts declared $kind policy", (policy) => {
    expect(Either.isRight(decode(policy))).toBe(true);
  });

  it.each([
    { kind: "error-edge", failure },
    { kind: "error-edge", edgeId: "charge-error" },
    {
      kind: "error-edge",
      edgeId: "charge-error",
      failure: { ...failure, code: "unsafe code" },
    },
    {
      kind: "error-edge",
      edgeId: "charge-error",
      failure: { ...failure, message: "unsafe\nmessage" },
    },
    {
      kind: "compensation",
      edgeId: "charge-compensated",
      capability: "public.reverseCharge",
      stepName: "reverse-charge",
      failure,
    },
  ])("rejects incomplete or unsafe policy %#", (policy) => {
    expect(Either.isLeft(decode(policy))).toBe(true);
  });

  it("rejects routing that the node did not declare", () => {
    expect(
      validateDeclaredWorkflowFailureRouting(undefined, "error-edge"),
    ).toEqual([expect.stringContaining("undeclared error-edge routing")]);
    expect(
      validateDeclaredWorkflowFailureRouting({ kind: "fail" }, "compensation"),
    ).toEqual([expect.stringContaining("undeclared compensation routing")]);
    expect(
      validateDeclaredWorkflowFailureRouting(
        { kind: "error-edge" },
        "error-edge",
      ),
    ).toEqual([]);
  });
});
