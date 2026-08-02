import * as Schema from "effect/Schema";
import type { GenericId } from "convex/values";
import { v } from "convex/values";
import * as Effect from "effect/Effect";
import * as Data from "effect/Data";

import { DatabaseReader } from "../../_generated/services";
import { sha256Hex } from "../../shared/sha256";

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

export const WorkflowPolicyPosture = Schema.Union([
  NoWorkflowPolicyPosture,
  PinnedWorkflowPolicyPosture,
]);

export type WorkflowPolicyPosture = Schema.Schema.Type<
  typeof WorkflowPolicyPosture
>;

export const WorkflowPolicySnapshot = Schema.Union([
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
      Schema.check(Schema.isFinite()),
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    ),
  }),
]);
export type WorkflowPolicySnapshot = Schema.Schema.Type<
  typeof WorkflowPolicySnapshot
>;

export const WorkflowPolicySnapshotValidator = v.union(
  v.object({
    version: v.literal(1),
    kind: v.literal("none"),
    reason: v.string(),
  }),
  v.object({
    version: v.literal(1),
    kind: v.literal("pinned"),
    schemaName: v.string(),
    policyVersionId: v.string(),
    policyHash: v.string(),
    resolvedAt: v.number(),
  }),
);

export class WorkflowPolicyResolutionError extends Data.TaggedError(
  "WorkflowPolicyResolutionError",
)<{ readonly reason: "unavailable" }> {}

export const resolveWorkflowPolicySnapshotForRun = (
  posture: WorkflowPolicyPosture,
  input: { readonly workspaceId: string; readonly resolvedAt: number },
) =>
  posture.kind === "none"
    ? Effect.succeed<WorkflowPolicySnapshot>({
        version: 1,
        kind: "none",
        reason: posture.reason,
      })
    : Effect.gen(function* () {
        const reader = yield* DatabaseReader;
        const row = yield* reader
          .table("policies")
          .get(posture.policyVersionId as GenericId<"policies">)
          .pipe(Effect.orDie);
        if (
          row === null ||
          (row.scope === "workspace" &&
            row.workspaceId !== input.workspaceId) ||
          workflowPolicyRowHash(row) !== posture.policyHash
        ) {
          return yield* new WorkflowPolicyResolutionError({
            reason: "unavailable",
          });
        }
        return {
          version: 1 as const,
          ...posture,
          resolvedAt: input.resolvedAt,
        };
      });

export const workflowPolicyRowHash = (row: {
  readonly policyKey: string;
  readonly kind: string;
  readonly scope: string;
  readonly workspaceId?: string | undefined;
  readonly version: number;
  readonly dataJson: string;
}): string =>
  sha256Hex(
    JSON.stringify({
      policyKey: row.policyKey,
      kind: row.kind,
      scope: row.scope,
      ...(row.workspaceId ? { workspaceId: row.workspaceId } : {}),
      version: row.version,
      dataJson: row.dataJson,
    }),
  );

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
