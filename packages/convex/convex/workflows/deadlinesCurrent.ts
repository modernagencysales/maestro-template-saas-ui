import {
  type WorkId,
  Workpool,
  type WorkpoolComponent,
} from "@convex-dev/workpool";
import {
  componentsGeneric,
  type FunctionReference,
  makeFunctionReference,
} from "convex/server";
import { type GenericId, v } from "convex/values";
import * as Either from "effect/Either";
import { internalMutation } from "../_generated/server";
import {
  createMaestroWorkflowLifecycleAdapter,
  type MaestroWorkflowComponent,
} from "../../confect/workflows/_kit/defineMaestroWorkflow";
import {
  planWorkflowDeadlineCallback,
  planWorkflowDeadlineSchedule,
  type WorkflowDeadlineSchedule,
} from "../../confect/workflows/_kit/workflowDeadline";

const components = componentsGeneric() as Record<string, unknown>;
const deadlineComponent = (
  components.workflowDeadline as {
    deadlines: Record<
      string,
      FunctionReference<"mutation" | "query", "internal">
    >;
  }
).deadlines;
const admissionTransition = (
  components.workflowAdmission as {
    admission: { transition: FunctionReference<"mutation", "internal"> };
  }
).admission.transition;
const deadlinePool = new Workpool(
  components.workflowDeadlineWorkpool as WorkpoolComponent,
  { maxParallelism: 20, retryActionsByDefault: false },
);
const workflowComponent = components.workflow as MaestroWorkflowComponent;

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
type AppMutationCtx = Parameters<
  Parameters<typeof internalMutation>[0]["handler"]
>[0];

const fireRef = makeFunctionReference<
  "mutation",
  ReturnType<typeof serialize>,
  null
>("workflows/deadlinesCurrent:fire") as FunctionReference<
  "mutation",
  "internal",
  DeadlineSchedule,
  null
>;

export const schedule = internalMutation({
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
    const planned = Either.getOrThrow(
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
    const prepared = (await ctx.runMutation(
      deadlineComponent.prepare,
      serial,
    )) as {
      kind: "create" | "replace" | "replay";
      priorWorkId: string | null;
    };
    if (prepared.kind === "replay")
      return { kind: "scheduled" as const, ...serial };
    if (prepared.priorWorkId)
      await deadlinePool.cancel(ctx, prepared.priorWorkId as WorkId);
    const workId = await deadlinePool.enqueueMutation(ctx, fireRef, serial, {
      runAt: planned.schedule.runAt,
      name: "workflow-deadline",
    });
    await ctx.runMutation(deadlineComponent.bind, {
      scheduleKey: serial.scheduleKey,
      requestedAt: serial.requestedAt,
      workId,
    });
    await ctx.db.patch(args.workflowRunId, {
      timeoutMs: args.horizonMs,
      deadlineAt: planned.schedule.deadlineAt,
    });
    return { kind: "scheduled" as const, ...serial };
  },
});

export const fire = internalMutation({
  args: callbackArgs,
  handler: async (ctx, args) => {
    const actualStartedAt = Date.now();
    const callbackSchedule = deserialize(args);
    const runId = args.workflowRunId as GenericId<"workflowRuns">;
    const run = await ctx.db.get(runId);
    const current = (await ctx.runQuery(deadlineComponent.current, {
      workflowRunId: args.workflowRunId,
      generation: run?.lifecycleGeneration ?? args.generation,
    })) as (ReturnType<typeof serialize> & { state: string }) | null;
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
    const decision = Either.getOrThrow(
      planWorkflowDeadlineCallback({
        callbackSchedule,
        currentRun,
        actualStartedAt,
      }),
    );
    if (decision.kind === "no-op") {
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
    await ctx.db.patch(runId, {
      status: "timedOut",
      completedAt: actualStartedAt,
      timedOutAt: actualStartedAt,
      timeoutErrorCode: "WORKFLOW_DEADLINE_EXPIRED",
      timeoutSummary: "Workflow exceeded its configured deadline.",
      lifecycleExecution: "canceled",
      priorGenerationQuiescence: "pending",
    });
    await ctx.runMutation(admissionTransition, {
      workflowRunId: runId,
      status: "timedOut",
    });
    await observe(ctx, callbackSchedule, decision.facts, undefined, "timedOut");
    return null;
  },
});

export const reconcile = internalMutation({
  args: { workflowRunId: v.id("workflowRuns"), generation: v.number() },
  handler: async (ctx, args) => {
    const workId = (await ctx.runQuery(deadlineComponent.beginReconcile, {
      workflowRunId: String(args.workflowRunId),
      generation: args.generation,
    })) as string | null;
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
