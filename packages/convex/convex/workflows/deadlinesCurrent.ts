import { type WorkId, Workpool } from "@convex-dev/workpool";
import { DatabaseWriter } from "@confect/server";
import { internalMutationGeneric, makeFunctionReference } from "convex/server";
import { type GenericId, v } from "convex/values";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import type { MutationCtx as AppMutationCtx } from "../_generated/server";
import databaseSchema from "../../confect/_generated/schema";
import { createMaestroWorkflowLifecycleAdapter } from "../../confect/workflows/_kit/defineMaestroWorkflow";
import { localWorkflowComponents as components } from "../../confect/workflows/_kit/localComponentRefs";
import {
  planWorkflowDeadlineCallback,
  planWorkflowDeadlineSchedule,
  type WorkflowDeadlineSchedule,
} from "../../confect/workflows/_kit/workflowDeadline";

const deadlineComponent = components.workflowDeadline.deadlines;
const admissionTransition = components.workflowAdmission.admission.transition;
const deadlinePool = new Workpool(components.workflowDeadlineWorkpool, {
  maxParallelism: 20,
  retryActionsByDefault: false,
});
const workflowComponent = components.workflow;
const workflowRunsWriter = (ctx: AppMutationCtx) =>
  DatabaseWriter.make(databaseSchema, ctx.db).table("workflowRuns");

const callbackArgs = {
  workspaceId: v.string(),
  workflowRunId: v.string(),
  workflowId: v.string(),
  workflowVersion: v.number(),
  generation: v.number(),
  scheduleKey: v.string(),
  requestedAt: v.number(),
  horizonMs: v.number(),
  deadlineAt: v.number(),
  runAt: v.number(),
};

type DeadlineSchedule = WorkflowDeadlineSchedule;
const fireRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:fire",
);
const recoverRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:recover",
);

const enqueueDeadline = (
  ctx: AppMutationCtx,
  serial: ReturnType<typeof serialize>,
  runAt: number,
) =>
  deadlinePool.enqueueMutation(ctx, fireRef, serial, {
    runAt,
    name: "workflow-deadline",
    onComplete: recoverRef,
    context: serial,
  });

export const schedule = internalMutationGeneric({
  args: {
    workspaceId: v.id("workspaces"),
    workflowRunId: v.id("workflowRuns"),
    requestedAt: v.number(),
    horizonMs: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.workflowRunId);
    if (!run || run.workspaceId !== args.workspaceId)
      return { kind: "no-op" as const };
    assertRunAuthority(run, String(args.workspaceId));
    const planned = Result.getOrThrow(
      planWorkflowDeadlineSchedule({
        generation: {
          workspaceId: String(args.workspaceId),
          workflowRunId: String(args.workflowRunId),
          workflowId: run.workflowId,
          workflowVersion: run.workflowVersion,
          generation: run.lifecycleGeneration ?? 0,
        },
        execution: run.lifecycleExecution ?? "active",
        requestedAt: args.requestedAt,
        horizonMs: args.horizonMs,
      }),
    );
    if (planned.kind === "no-op") return planned;
    const serial = serialize(planned.schedule);
    const prepared = await ctx.runMutation(deadlineComponent.prepare, serial);
    if (prepared.kind === "replay")
      return { kind: "scheduled" as const, ...serial };
    if (prepared.priorWorkId)
      await deadlinePool.cancel(ctx, prepared.priorWorkId as WorkId);
    const workId = await enqueueDeadline(ctx, serial, planned.schedule.runAt);
    await ctx.runMutation(deadlineComponent.bind, {
      scheduleKey: serial.scheduleKey,
      requestedAt: serial.requestedAt,
      workId,
    });
    await Effect.runPromise(
      workflowRunsWriter(ctx).patch(args.workflowRunId, {
        timeoutMs: args.horizonMs,
        deadlineAt: planned.schedule.deadlineAt,
      }),
    );
    return { kind: "scheduled" as const, ...serial };
  },
});

export const fire = internalMutationGeneric({
  args: callbackArgs,
  handler: async (ctx, args) => {
    const actualStartedAt = Date.now();
    const callbackSchedule = deserialize(args);
    const runId = args.workflowRunId as GenericId<"workflowRuns">;
    const run = await ctx.db.get(runId);
    const current = await ctx.runQuery(deadlineComponent.current, {
      workflowRunId: args.workflowRunId,
      generation: run?.lifecycleGeneration ?? args.generation,
    });
    const currentRun =
      run && run.workspaceId === args.workspaceId
        ? {
            workspaceId: String(run.workspaceId),
            workflowRunId: args.workflowRunId,
            workflowId: run.workflowId,
            workflowVersion: run.workflowVersion,
            generation: run.lifecycleGeneration ?? 0,
            execution: run.lifecycleExecution ?? "active",
            deadlineSchedule: current ? deserialize(current) : null,
          }
        : {
            ...callbackSchedule.identity,
            execution: "terminal" as const,
            deadlineSchedule: null,
          };
    const decision = Result.getOrThrow(
      planWorkflowDeadlineCallback({
        callbackSchedule,
        currentRun,
        actualStartedAt,
      }),
    );
    if (decision.kind === "no-op") {
      if (decision.facts === null) return null;
      await observe(
        ctx,
        callbackSchedule,
        decision.facts,
        decision.reason,
        "noOp",
      );
      return null;
    }
    if (!run || !run.componentWorkflowId) {
      await observe(
        ctx,
        callbackSchedule,
        decision.facts,
        "stale-schedule",
        "noOp",
      );
      return null;
    }
    assertRunAuthority(run, args.workspaceId);
    await createMaestroWorkflowLifecycleAdapter(workflowComponent, ctx).cancel(
      run.componentWorkflowId,
    );
    await Effect.runPromise(
      workflowRunsWriter(ctx).patch(runId, {
        status: "timedOut",
        completedAt: actualStartedAt,
        timedOutAt: actualStartedAt,
        timeoutErrorCode: "WORKFLOW_DEADLINE_EXPIRED",
        timeoutSummary: "Workflow exceeded its configured deadline.",
        lifecycleExecution: "canceled",
        priorGenerationQuiescence: "pending",
      }),
    );
    await ctx.runMutation(admissionTransition, {
      workflowRunId: runId,
      status: "timedOut",
    });
    await observe(ctx, callbackSchedule, decision.facts, undefined, "timedOut");
    return null;
  },
});

export const recover = deadlinePool.defineOnComplete({
  context: v.object(callbackArgs),
  handler: async (ctx, { workId, context, result }) => {
    if (result.kind !== "failed") return;
    const failedAt = Date.now();
    const retry = await ctx.runMutation(deadlineComponent.prepareRetry, {
      scheduleKey: context.scheduleKey,
      requestedAt: context.requestedAt,
      completedWorkId: workId,
      failedAt,
    });
    if (retry.kind !== "retry") return;
    const nextWorkId = await deadlinePool.enqueueMutation(
      ctx,
      fireRef,
      context,
      {
        runAt: retry.retryAt,
        name: "workflow-deadline-recovery",
        onComplete: recoverRef,
        context,
      },
    );
    await ctx.runMutation(deadlineComponent.bind, {
      scheduleKey: context.scheduleKey,
      requestedAt: context.requestedAt,
      workId: nextWorkId,
    });
  },
});

export const reconcile = internalMutationGeneric({
  args: { workflowRunId: v.id("workflowRuns"), generation: v.number() },
  handler: async (ctx, args) => {
    const workId = await ctx.runQuery(deadlineComponent.beginReconcile, {
      workflowRunId: String(args.workflowRunId),
      generation: args.generation,
    });
    if (workId) {
      await deadlinePool.cancel(ctx, workId as WorkId);
      await ctx.runMutation(deadlineComponent.completeReconcile, {
        workflowRunId: String(args.workflowRunId),
        generation: args.generation,
        workId,
      });
    }
    return null;
  },
});

const observe = async (
  ctx: AppMutationCtx,
  schedule: DeadlineSchedule,
  facts: {
    actualStartedAt: number;
    latenessMs: number;
    expired: boolean;
    expiredByMs: number;
  },
  noOpReason:
    | "terminal-run"
    | "stale-generation"
    | "stale-schedule"
    | "deadline-not-reached"
    | undefined,
  state: "timedOut" | "noOp",
) => {
  const { actualStartedAt, latenessMs, expired, expiredByMs } = facts;
  await ctx.runMutation(deadlineComponent.observe, {
    scheduleKey: schedule.identity.scheduleKey,
    requestedAt: schedule.requestedAt,
    state,
    actualStartedAt,
    latenessMs,
    expired,
    expiredByMs,
    ...(noOpReason ? { noOpReason } : {}),
  });
};

const serialize = (schedule: DeadlineSchedule) => ({
  ...schedule.identity,
  requestedAt: schedule.requestedAt,
  horizonMs: schedule.horizonMs,
  deadlineAt: schedule.deadlineAt,
  runAt: schedule.runAt,
});

const deserialize = (
  value: ReturnType<typeof serialize>,
): DeadlineSchedule => ({
  identity: {
    workspaceId: value.workspaceId,
    workflowRunId: value.workflowRunId,
    workflowId: value.workflowId,
    workflowVersion: value.workflowVersion,
    generation: value.generation,
    scheduleKey: value.scheduleKey,
  },
  requestedAt: value.requestedAt,
  horizonMs: value.horizonMs,
  deadlineAt: value.deadlineAt,
  runAt: value.runAt,
});

const assertRunAuthority = (
  run: {
    workspaceId: string;
    principalSnapshot?: { workspaceId: string } | null;
  },
  workspaceId: string,
) => {
  if (
    String(run.workspaceId) !== workspaceId ||
    run.principalSnapshot?.workspaceId !== workspaceId
  ) {
    throw new Error("WORKFLOW_DEADLINE_AUTHORITY_INVALID");
  }
};
