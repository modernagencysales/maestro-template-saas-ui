import {
  makeWorkflowFailurePolicySchema,
  WorkflowSettledFailure as WorkflowSettledFailureSchema,
  type WorkflowFailurePolicy as WorkflowFailurePolicyContract,
  type WorkflowSettledFailure,
} from "@maestro-template/template-core/workflow-semantics";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import {
  WorkflowCapabilityReference,
  WorkflowStepName,
  type WorkflowCapabilityReference as WorkflowCapabilityReferenceType,
  type WorkflowStepName as WorkflowStepNameType,
} from "./workflowReferences";

export const WorkflowFailurePolicy = makeWorkflowFailurePolicySchema({
  WorkflowCapabilityReference,
  WorkflowStepName,
});

/** Non-capability node kinds have no typed domain-failure compiler yet. */
export const WorkflowFailOnlyPolicy = Schema.Struct({
  kind: Schema.Literal("fail"),
});

export type WorkflowFailurePolicy = WorkflowFailurePolicyContract<
  WorkflowCapabilityReferenceType,
  WorkflowStepNameType
>;

export type WorkflowFailureRoute = Exclude<
  WorkflowFailurePolicy,
  { readonly kind: "fail" }
>;

export type { WorkflowSettledFailure };

export const declaredWorkflowFailureRoute = (
  policy: WorkflowFailurePolicy,
): WorkflowFailureRoute | undefined =>
  policy.kind === "fail" ? undefined : policy;

export const decodeWorkflowSettledFailure = (
  value: unknown,
): WorkflowSettledFailure | undefined => {
  const decoded = Schema.decodeUnknownExit(WorkflowSettledFailureSchema)(value);
  return Exit.isSuccess(decoded) ? decoded.value : undefined;
};

export const sameWorkflowSettledFailure = (
  left: WorkflowSettledFailure,
  right: WorkflowSettledFailure,
): boolean =>
  left._tag === right._tag &&
  left.code === right.code &&
  left.message === right.message;

export const unsupportedWorkflowFailurePolicyFinding = (
  node: Readonly<Record<string, unknown>>,
): string | undefined => {
  if (
    node.kind === "capability" ||
    !("failurePolicy" in node) ||
    typeof node.failurePolicy !== "object" ||
    node.failurePolicy === null ||
    !("kind" in node.failurePolicy) ||
    node.failurePolicy.kind === "fail"
  ) {
    return undefined;
  }
  const id = typeof node.id === "string" ? node.id : "unknown";
  return `WF-NODE-FAILURE-POLICY: node ${id} supports fail only; repair: move typed failure routing to a capability node`;
};

export const workflowFailurePolicy = {
  fail: (): WorkflowFailurePolicy => ({ kind: "fail" }),
  errorEdge: (input: {
    readonly edgeId: string;
    readonly failure: {
      readonly _tag: "WorkflowSettledFailure";
      readonly code: string;
      readonly message: string;
    };
  }): WorkflowFailurePolicy =>
    Schema.decodeSync(WorkflowFailurePolicy)({ kind: "error-edge", ...input }),
  compensation: (input: {
    readonly edgeId: string;
    readonly steps: readonly {
      readonly forNodeId: string;
      readonly capability: string;
      readonly stepName: string;
    }[];
    readonly failure: {
      readonly _tag: "WorkflowSettledFailure";
      readonly code: string;
      readonly message: string;
    };
  }): WorkflowFailurePolicy =>
    Schema.decodeSync(WorkflowFailurePolicy)({
      kind: "compensation",
      ...input,
    }),
} as const;
