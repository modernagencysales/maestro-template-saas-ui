import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { DatabaseReader } from "../_generated/services";
import type { WorkflowRestartInspection } from "./_kit/lifecycleControls";
import { decodeSubworkflowRunLinkIdentity } from "./_kit/subworkflowLinks";
import { WorkflowLifecyclePersistenceError } from "./lifecyclePersistence";

type Reader = Context.Service.Shape<typeof DatabaseReader>;

export const inspectWorkflowRetention = (
  reader: Reader,
  input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly componentWorkflowId: string;
  },
) =>
  Effect.gen(function* () {
    const run = yield* reader
      .table("workflowRuns")
      .get(
        input.workflowRunId as import("convex/values").GenericId<"workflowRuns">,
      )
      .pipe(Effect.orDie);
    const links = yield* readParentLinks(reader, input);
    const evidence = yield* reader
      .table("workflowRunEvidenceSnapshots")
      .index("by_run", (q) => q.eq("workflowRunId", input.workflowRunId))
      .collect()
      .pipe(Effect.orDie);
    const childRuns = yield* Effect.forEach(links, (link) => {
      const identity = decodeSubworkflowRunLinkIdentity(link);
      if (identity.childWorkflowRunId !== null) {
        return reader
          .table("workflowRuns")
          .get(
            identity.childWorkflowRunId as import("convex/values").GenericId<"workflowRuns">,
          )
          .pipe(Effect.orDie);
      }
      const childComponentWorkflowId =
        identity.schemaVersion === 1
          ? identity.historicalChildComponentId
          : link.childWorkflowId;
      return childComponentWorkflowId
        ? reader
            .table("workflowRuns")
            .index("by_workspace_component_workflow", (q) =>
              q
                .eq("workspaceId", input.workspaceId)
                .eq("componentWorkflowId", childComponentWorkflowId),
            )
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie)
        : Effect.succeed(null);
    });
    const childDeadlines = childRuns.flatMap((child) =>
      child
        ? [
            child.parentRetentionUntil,
            child.childRetentionUntil,
            child.evidenceRetentionUntil,
          ].filter((value): value is number => value != null)
        : [],
    );
    return {
      parentUntil: run?.parentRetentionUntil ?? null,
      childUntil: maxDeadline(run?.childRetentionUntil, childDeadlines),
      evidenceUntil: run?.evidenceRetentionUntil ?? null,
      activeChildCount: links.filter(
        (link) => link.status === "starting" || link.status === "running",
      ).length,
      retentionUnverifiable:
        run === null ||
        childRuns.some((child) => child === null) ||
        (evidence.length > 0 && run.evidenceRetentionUntil == null),
    };
  });

const maxDeadline = (
  own: number | null | undefined,
  descendants: readonly number[],
): number | null => {
  const values = [...(own == null ? [] : [own]), ...descendants];
  return values.length === 0 ? null : Math.max(...values);
};

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
    const children = yield* readParentLinks(reader, input);
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

const readParentLinks = (
  reader: Reader,
  input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly componentWorkflowId: string;
  },
) =>
  Effect.all([
    reader
      .table("workflowRunLinks")
      .index("by_workspace_and_parent", (q) =>
        q
          .eq("workspaceId", input.workspaceId)
          .eq("parentWorkflowId", input.workflowRunId),
      )
      .collect()
      .pipe(Effect.orDie),
    reader
      .table("workflowRunLinks")
      .index("by_workspace_and_parent", (q) =>
        q
          .eq("workspaceId", input.workspaceId)
          .eq("parentWorkflowId", input.componentWorkflowId),
      )
      .collect()
      .pipe(Effect.orDie),
  ]).pipe(
    Effect.map(([productRows, historicalRows]) => [
      ...new Map(
        [...productRows, ...historicalRows].map((row) => [row._id, row]),
      ).values(),
    ]),
  );

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
