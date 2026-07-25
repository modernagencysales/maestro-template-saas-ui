import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";

import { DatabaseReader } from "../_generated/services";
import type { WorkflowRestartInspection } from "./_kit/lifecycleControls";
import { WorkflowLifecyclePersistenceError } from "./lifecyclePersistence";

type Reader = Context.Tag.Service<typeof DatabaseReader>;

export const inspectWorkflowExposedWork = (
  reader: Reader,
  input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly componentWorkflowId: string;
  },
) =>
  Effect.gen(function* () {
    const stages = yield* reader
      .table("workflowStageRuns")
      .index("by_run", (q) => q.eq("workflowRunId", input.workflowRunId))
      .collect()
      .pipe(Effect.orDie);
    const children = yield* reader
      .table("workflowRunLinks")
      .index("by_workspace_and_parent", (q) =>
        q
          .eq("workspaceId", input.workspaceId)
          .eq("parentWorkflowId", input.componentWorkflowId),
      )
      .collect()
      .pipe(Effect.orDie);
    return {
      inProgressSteps: stages
        .filter(
          (stage) => stage.status === "queued" || stage.status === "running",
        )
        .map((stage) => stage.stageKey ?? stage.nodeId),
      inProgressChildren: children
        .filter(
          (child) => child.status === "starting" || child.status === "running",
        )
        .map((child) => child.relationId),
    };
  });

export const inspectWorkflowRestart = (
  reader: Reader,
  input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly generation: number;
    readonly restartAnchor: string;
  },
): Effect.Effect<
  WorkflowRestartInspection,
  WorkflowLifecyclePersistenceError
> =>
  Effect.gen(function* () {
    const stages = yield* reader
      .table("workflowStageRuns")
      .index("by_run", (q) => q.eq("workflowRunId", input.workflowRunId))
      .collect()
      .pipe(Effect.orDie);
    const ordered = stages
      .filter(
        (stage) =>
          stage.lifecycleGeneration === input.generation &&
          stage.stageKey !== undefined,
      )
      .sort(
        (left, right) =>
          (left.order ?? Number.MAX_SAFE_INTEGER) -
            (right.order ?? Number.MAX_SAFE_INTEGER) ||
          (left.attemptNumber ?? left.attempt) -
            (right.attemptNumber ?? right.attempt),
      );
    const anchorOrder = findRestartAnchorOrder(ordered, input.restartAnchor);
    if (anchorOrder === undefined) {
      return yield* new WorkflowLifecyclePersistenceError({
        message: "Restart anchor is not present in the persisted run graph.",
      });
    }
    const discardedSteps = [
      ...new Set(
        ordered
          .filter(
            (stage) => (stage.order ?? Number.MAX_SAFE_INTEGER) >= anchorOrder,
          )
          .map((stage) => stage.stageKey)
          .filter((step): step is string => step !== undefined),
      ),
    ];
    const reservations = yield* Effect.forEach(discardedSteps, (stepName) =>
      reader
        .table("workflowEffectReservations")
        .index("by_run_generation_step", (q) =>
          q
            .eq("workflowRunId", input.workflowRunId)
            .eq("generation", input.generation)
            .eq("stepName", stepName),
        )
        .collect()
        .pipe(Effect.orDie),
    );
    const reservationsByStep = new Map(
      reservations.flat().map((reservation) => [reservation.stepName, true]),
    );
    const missingExternalReservation = ordered.find(
      (stage) =>
        (stage.order ?? Number.MAX_SAFE_INTEGER) >= anchorOrder &&
        stage.kind === "capability" &&
        stage.externalEffect !== false &&
        stage.stageKey !== undefined &&
        !reservationsByStep.has(stage.stageKey),
    );
    if (missingExternalReservation?.stageKey) {
      return yield* new WorkflowLifecyclePersistenceError({
        message: `External step ${missingExternalReservation.stageKey} has no generation-scoped restart reservation.`,
      });
    }
    return {
      discardedSteps,
      externalEffects: reservations.flat().map((reservation) => ({
        stepName: reservation.stepName,
        restartSafe: reservation.strategy !== "non-retriable",
        restartSafeUntil: reservation.restartSafeUntil,
        dedupeExpiresAt: reservation.dedupeExpiresAt,
      })),
    };
  });

const findRestartAnchorOrder = (
  stages: readonly {
    readonly stageKey?: string | undefined;
    readonly order?: number | undefined;
  }[],
  restartAnchor: string,
): number | undefined => {
  if (restartAnchor === "beginning") return Number.NEGATIVE_INFINITY;
  for (let index = stages.length - 1; index >= 0; index -= 1) {
    const stage = stages[index];
    if (stage?.stageKey === restartAnchor) return stage.order;
  }
  return undefined;
};
