import * as Schema from "effect/Schema";

export const NoWorkflowPolicyPosture = Schema.Struct({
  kind: Schema.Literal("none"),
  reason: Schema.NonEmptyString,
});

export const PinnedWorkflowPolicyPosture = Schema.Struct({
  kind: Schema.Literal("pinned"),
  schemaName: Schema.NonEmptyString,
  policyVersionId: Schema.NonEmptyString,
  policyHash: Schema.NonEmptyString,
});

export const WorkflowPolicyPosture = Schema.Union(
  NoWorkflowPolicyPosture,
  PinnedWorkflowPolicyPosture,
);

export type WorkflowPolicyPosture = Schema.Schema.Type<
  typeof WorkflowPolicyPosture
>;

export const policyPosture = {
  none: (reason: string) => ({ kind: "none", reason }) as const,
  pinned: (input: {
    readonly schemaName: string;
    readonly policyVersionId: string;
    readonly policyHash: string;
  }) => ({ kind: "pinned", ...input }) as const,
};
