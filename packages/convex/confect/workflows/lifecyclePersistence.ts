import { ConvexError, type GenericId } from "convex/values";
import type * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import type {
  Page,
  PaginationInput,
  WorkflowLifecycleAuditEvent,
  WorkflowLifecycleOwnedRun,
  WorkflowRunProjectionSource,
  WorkflowStepProjectionSource,
} from "./_kit/lifecycleControls";
import {
  deriveGenerationAnchor,
  type WorkflowLifecycleState,
} from "./_kit/lifecycleState";
import { WorkflowStepName } from "./_kit/workflowReferences";

type Reader = Context.Service.Shape<typeof DatabaseReader>;
type Writer = Context.Service.Shape<typeof DatabaseWriter>;
type WorkflowRunId = GenericId<"workflowRuns">;

export class WorkflowLifecyclePersistenceError extends Data.TaggedError(
  "WorkflowLifecyclePersistenceError",
)<{ readonly message: string }> {}

export const loadOwnedWorkflowRun = (
  reader: Reader,
  workspaceId: string,
  workflowRunId: string,
) =>
  reader
    .table("workflowRuns")
    .get(workflowRunId as WorkflowRunId)
    .pipe(
      Effect.orDie,
      Effect.flatMap((row) => {
        if (
          row === null ||
          row.workspaceId !== workspaceId ||
          !row.componentWorkflowId
        ) {
          return Effect.succeed(null);
        }
        const componentWorkflowId = row.componentWorkflowId;
        return Effect.try({
          try: (): WorkflowLifecycleOwnedRun => ({
            workflowRunId: String(row._id),
            componentWorkflowId,
            workflowName: row.workflowId,
            state: decodeLifecycleState(row),
          }),
          catch: () =>
            new WorkflowLifecyclePersistenceError({
              message: "Workflow lifecycle state is unavailable.",
            }),
        });
      }),
    );

export const persistWorkflowLifecycleState = (
  writer: Writer,
  workflowRunId: string,
  state: WorkflowLifecycleState,
) =>
  writer
    .table("workflowRuns")
    .patch(workflowRunId as WorkflowRunId, {
      lifecycleExecution: state.execution,
      lifecycleGeneration: state.generation,
      lifecycleGenerationAnchor: state.generationAnchor,
      lifecycleRestartAnchor: state.restartAnchor,
      priorGenerationQuiescence: state.priorGenerationQuiescence,
      cleanupState: state.cleanup,
      componentCleanupState: state.componentCleanup,
      componentResidualState: state.componentResiduals,
      parentRetentionUntil: state.retention.parentUntil,
      childRetentionUntil: state.retention.childUntil,
      evidenceRetentionUntil: state.retention.evidenceUntil,
    })
    .pipe(Effect.orDie);

export const appendWorkflowLifecycleAudit = (
  writer: Writer,
  reader: Reader,
  event: WorkflowLifecycleAuditEvent,
) =>
  Effect.gen(function* () {
    const previous = yield* reader
      .table("workflowRunEvents")
      .index(
        "by_run_sequence",
        (q) => q.eq("workflowRunId", event.workflowRunId),
        "desc",
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    yield* writer
      .table("workflowRunEvents")
      .insert({
        workflowRunId: event.workflowRunId,
        sequence: (previous?.sequence ?? 0) + 1,
        type: event.type,
        nodeId: null,
        payloadJson: JSON.stringify(redactedAuditPayload(event)),
        createdAt: event.occurredAt,
      })
      .pipe(Effect.orDie);
  });

export const listOwnedWorkflowRuns = (
  reader: Reader,
  workspaceId: string,
  pagination: PaginationInput,
  workflowName?: string,
): Effect.Effect<Page<WorkflowRunProjectionSource>> =>
  reader
    .table("workflowRuns")
    .index("by_idempotency_key", (q) => q.eq("workspaceId", workspaceId))
    .paginate(
      { cursor: pagination.cursor, numItems: pagination.limit },
      workflowName === undefined
        ? undefined
        : (q) => q.eq(q.field("workflowId"), workflowName),
    )
    .pipe(
      Effect.map((result) => ({
        page: result.page.map(projectRun),
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      })),
      Effect.orDie,
    );

export const listOwnedWorkflowSteps = (
  reader: Reader,
  workflowRunId: string,
  pagination: PaginationInput,
): Effect.Effect<Page<WorkflowStepProjectionSource>> =>
  reader
    .table("workflowStageRuns")
    .index("by_run", (q) => q.eq("workflowRunId", workflowRunId))
    .paginate({ cursor: pagination.cursor, numItems: pagination.limit })
    .pipe(
      Effect.map((result) => ({
        page: result.page.map(projectStep),
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      })),
      Effect.orDie,
    );

const decodeLifecycleState = (row: {
  readonly _id: WorkflowRunId;
  readonly workspaceId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly lifecycleExecution?:
    WorkflowLifecycleState["execution"] | null | undefined;
  readonly lifecycleGeneration?: number | null | undefined;
  readonly lifecycleGenerationAnchor?: string | null | undefined;
  readonly lifecycleRestartAnchor?: string | null | undefined;
  readonly priorGenerationQuiescence?:
    WorkflowLifecycleState["priorGenerationQuiescence"] | null | undefined;
  readonly cleanupState?: WorkflowLifecycleState["cleanup"] | null | undefined;
  readonly componentCleanupState?:
    WorkflowLifecycleState["componentCleanup"] | null | undefined;
  readonly componentResidualState?:
    WorkflowLifecycleState["componentResiduals"] | null | undefined;
  readonly parentRetentionUntil?: number | null | undefined;
  readonly childRetentionUntil?: number | null | undefined;
  readonly evidenceRetentionUntil?: number | null | undefined;
}): WorkflowLifecycleState => {
  if (
    row.lifecycleExecution == null ||
    row.lifecycleGeneration == null ||
    row.lifecycleGenerationAnchor == null ||
    row.priorGenerationQuiescence == null ||
    row.cleanupState == null ||
    row.componentCleanupState == null
  ) {
    throw new ConvexError({
      code: "WORKFLOW_LIFECYCLE_UNAVAILABLE",
      message: "missing lifecycle state",
    });
  }
  const expectedAnchor = deriveGenerationAnchor(
    row.workflowId,
    row.workflowVersion,
    row.lifecycleGeneration,
  );
  if (row.lifecycleGenerationAnchor !== expectedAnchor) {
    throw new ConvexError({
      code: "WORKFLOW_LIFECYCLE_UNAVAILABLE",
      message: "invalid generation anchor",
    });
  }
  const restartAnchor = decodeRestartAnchor(row.lifecycleRestartAnchor ?? null);
  return {
    workspaceId: row.workspaceId,
    workflowRunId: String(row._id),
    workflowId: row.workflowId,
    workflowVersion: row.workflowVersion,
    execution: row.lifecycleExecution,
    generation: row.lifecycleGeneration,
    generationAnchor: row.lifecycleGenerationAnchor,
    restartAnchor,
    priorGenerationQuiescence: row.priorGenerationQuiescence,
    cleanup: row.cleanupState,
    componentCleanup:
      row.componentCleanupState === "component-residuals-unverifiable"
        ? "component-cleanup-requested"
        : row.componentCleanupState,
    componentResiduals:
      row.componentResidualState ??
      (row.componentCleanupState === "component-residuals-unverifiable"
        ? "component-residuals-unverifiable"
        : "not-assessed"),
    retention: {
      parentUntil: row.parentRetentionUntil ?? null,
      childUntil: row.childRetentionUntil ?? null,
      evidenceUntil: row.evidenceRetentionUntil ?? null,
    },
  };
};

const decodeRestartAnchor = (value: string | null) =>
  value === null || value === "beginning"
    ? value
    : Schema.decodeSync(WorkflowStepName)(value);

const projectRun = (row: {
  readonly _id: WorkflowRunId;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly status: WorkflowRunProjectionSource["status"];
  readonly lifecycleGeneration?: number | null | undefined;
  readonly startedAt: number;
  readonly completedAt: number | null;
}): WorkflowRunProjectionSource => ({
  workflowRunId: String(row._id),
  workflowName: row.workflowId,
  workflowId: row.workflowId,
  workflowVersion: row.workflowVersion,
  status: row.status,
  generation: row.lifecycleGeneration ?? 0,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
});

const projectStep = (row: {
  readonly nodeId: string;
  readonly stageKey?: string | undefined;
  readonly status: string;
  readonly attempt: number;
  readonly attemptNumber?: number | undefined;
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly errorJson: string | null;
}): WorkflowStepProjectionSource => ({
  stepName: row.stageKey ?? row.nodeId,
  status: row.status,
  attempt: row.attemptNumber ?? row.attempt,
  startedAt: row.startedAt,
  finishedAt: row.completedAt,
  errorCode: decodeErrorCode(row.errorJson),
});

const decodeErrorCode = (errorJson: string | null): string | null => {
  if (errorJson === null) return null;
  try {
    const value: unknown = JSON.parse(errorJson);
    if (
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      typeof value.code === "string" &&
      value.code.length <= 128
    ) {
      return value.code;
    }
  } catch {
    return null;
  }
  return null;
};

const redactedAuditPayload = (event: WorkflowLifecycleAuditEvent) => ({
  type: event.type,
  workspaceId: event.workspaceId,
  workflowRunId: event.workflowRunId,
  workflowId: event.workflowId,
  workflowVersion: event.workflowVersion,
  generation: event.generation,
  actorId: event.actorId,
  authority: event.authority,
  reasonCode: event.reasonCode,
  occurredAt: event.occurredAt,
  discardedStepCount: event.discardedStepCount,
  redacted: true as const,
});
