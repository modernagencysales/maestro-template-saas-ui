import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import { describe, expect, it } from "vitest";

import {
  makeWorkflowFailurePolicySchema,
  validateDeclaredWorkflowFailureRouting,
} from "./failure-policy";

const WorkflowCapabilityReference = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(/^capability\.[a-z][A-Za-z0-9]*\.v[1-9]\d*$/)),
  Schema.brand("WorkflowCapabilityReference"),
);
const WorkflowStepName = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*\.v[1-9]\d*$/)),
);
const FailurePolicy = makeWorkflowFailurePolicySchema({
  WorkflowCapabilityReference,
  WorkflowStepName,
});
const decode = Schema.decodeUnknownExit(FailurePolicy, {
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
      steps: [
        {
          forNodeId: "charge",
          capability: "capability.reverseCharge.v2",
          stepName: "reverse-charge.v2",
        },
      ],
      failure,
    },
  ])("accepts declared $kind policy", (policy) => {
    const decoded = decode(policy);
    expect(Exit.isSuccess(decoded)).toBe(true);
    if (Exit.isSuccess(decoded)) {
      expect(decoded.value).toEqual(policy);
    }
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
      steps: [
        {
          forNodeId: "charge",
          capability: "public.reverseCharge",
          stepName: "reverse-charge",
        },
      ],
      failure,
    },
    {
      kind: "compensation",
      edgeId: "charge-compensated",
      steps: [],
      failure,
    },
  ])("rejects incomplete or unsafe policy %#", (policy) => {
    const decoded = decode(policy);
    expect(Exit.isFailure(decoded)).toBe(true);
    if (Exit.isFailure(decoded)) {
      const error = Cause.findError(decoded.cause);
      expect(Result.isSuccess(error)).toBe(true);
      if (Result.isSuccess(error)) {
        expect(Schema.isSchemaError(error.success)).toBe(true);
        if (Schema.isSchemaError(error.success)) {
          expect(SchemaIssue.isIssue(error.success.issue)).toBe(true);
        }
      }
    }
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
