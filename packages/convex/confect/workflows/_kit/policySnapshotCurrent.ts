import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";

import { DatabaseReader } from "../../_generated/services";
import {
  type WorkflowPolicyPosture,
  WorkflowPolicyResolutionError,
  type WorkflowPolicySnapshot,
  workflowPolicyRowHash,
} from "./policySnapshot";

export type {
  WorkflowPolicyPosture,
  WorkflowPolicySnapshot,
} from "./policySnapshot";

export const resolveWorkflowPolicySnapshotForRun = (
  posture: WorkflowPolicyPosture,
  input: { readonly workspaceId: string; readonly resolvedAt: number },
) =>
  Effect.gen(function* () {
    if (posture.kind === "none") {
      return {
        version: 1,
        kind: "none",
        reason: posture.reason,
      } satisfies WorkflowPolicySnapshot;
    }
    const reader = yield* DatabaseReader;
    const row = yield* reader
      .table("policies")
      .get(posture.policyVersionId as GenericId<"policies">)
      .pipe(Effect.orDie);
    if (
      row === null ||
      (row.scope === "workspace" && row.workspaceId !== input.workspaceId) ||
      workflowPolicyRowHash(row) !== posture.policyHash
    ) {
      return yield* new WorkflowPolicyResolutionError({
        reason: "unavailable",
      });
    }
    return {
      version: 1,
      ...posture,
      resolvedAt: input.resolvedAt,
    } satisfies WorkflowPolicySnapshot;
  });
