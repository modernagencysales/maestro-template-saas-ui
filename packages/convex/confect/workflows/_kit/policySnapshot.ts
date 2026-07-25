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

export const WorkflowPolicySnapshot = Schema.Union(
  Schema.Struct({
    version: Schema.Literal(1),
    kind: Schema.Literal("none"),
    reason: Schema.NonEmptyString,
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    kind: Schema.Literal("pinned"),
    schemaName: Schema.NonEmptyString,
    policyVersionId: Schema.NonEmptyString,
    policyHash: Schema.NonEmptyString,
    resolvedAt: Schema.Number.pipe(
      Schema.finite(),
      Schema.greaterThanOrEqualTo(0),
    ),
  }),
);
export type WorkflowPolicySnapshot = Schema.Schema.Type<
  typeof WorkflowPolicySnapshot
>;

export const resolveWorkflowPolicySnapshot = async (
  posture: WorkflowPolicyPosture,
  input: {
    readonly resolvedAt: number;
    readonly resolvePinned: (reference: {
      readonly schemaName: string;
      readonly policyVersionId: string;
    }) => Promise<{ readonly policyHash: string }>;
  },
): Promise<WorkflowPolicySnapshot> => {
  if (posture.kind === "none") {
    return Schema.decodeUnknownSync(WorkflowPolicySnapshot)({
      version: 1,
      kind: "none",
      reason: posture.reason,
    });
  }
  const resolved = await input.resolvePinned(posture);
  if (resolved.policyHash !== posture.policyHash) {
    throw new Error("Pinned workflow policy is unavailable.");
  }
  return Schema.decodeUnknownSync(WorkflowPolicySnapshot)({
    version: 1,
    ...posture,
    resolvedAt: input.resolvedAt,
  });
};

export const assertWorkflowPolicySnapshot = (
  posture: WorkflowPolicyPosture,
  snapshot: WorkflowPolicySnapshot,
): void => {
  if (posture.kind === "none") {
    if (snapshot.kind === "none" && posture.reason === snapshot.reason) return;
    throw new Error("Workflow policy snapshot does not match its declaration.");
  }
  if (
    snapshot.kind !== "pinned" ||
    posture.schemaName !== snapshot.schemaName ||
    posture.policyVersionId !== snapshot.policyVersionId ||
    posture.policyHash !== snapshot.policyHash
  ) {
    throw new Error("Workflow policy snapshot does not match its declaration.");
  }
};

export const policyPosture = {
  none: (reason: string) => ({ kind: "none", reason }) as const,
  pinned: (input: {
    readonly schemaName: string;
    readonly policyVersionId: string;
    readonly policyHash: string;
  }) => ({ kind: "pinned", ...input }) as const,
};
