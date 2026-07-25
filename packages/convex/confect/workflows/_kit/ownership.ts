import { start, type WorkflowId } from "@convex-dev/workflow";
import type { FunctionArgs, FunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "../../_generated/services";
import { makePublicError } from "../../shared/errors";
import { validateCallerIdempotencyKey } from "../../shared/idempotencyKey";
import {
  createWorkflowLifecycleState,
  type WorkflowOnCompleteContext,
} from "./lifecycleState";

type Reader = Context.Tag.Service<typeof DatabaseReader>;
type Writer = Context.Tag.Service<typeof DatabaseWriter>;
type Mutation = Context.Tag.Service<typeof MutationCtx>;
type ExistingWorkflowRun = {
  readonly componentWorkflowId?: string | null | undefined;
};

export type WorkflowRunReservationInput = Pick<
  StartWorkflowOwnershipInput<FunctionReference<"mutation", "internal">>,
  | "workspaceId"
  | "workflowId"
  | "workflowVersion"
  | "graphJson"
  | "idempotencyKey"
  | "startedByUserId"
  | "startedAt"
  | "trustReceiptId"
  | "workflowKind"
  | "sourceRunKind"
  | "sourceRunId"
  | "timeoutMs"
  | "deadlineAt"
>;

export type StartWorkflowOwnershipInput<
  F extends FunctionReference<"mutation", "internal">,
> = {
  readonly workflowRef: F;
  readonly workflowArgs?: FunctionArgs<F>["args"];
  readonly buildWorkflowArgs?: (
    workflowRunId: string,
  ) => FunctionArgs<F>["args"];
  readonly workspaceId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly graphJson: string;
  readonly idempotencyKey: string;
  readonly startedByUserId: string;
  readonly startedAt: number;
  readonly trustReceiptId?: string | null;
  readonly workflowKind?: string;
  readonly sourceRunKind?: string;
  readonly sourceRunId?: string;
  readonly timeoutMs?: number;
  readonly deadlineAt?: number;
  readonly kickoffProfile: "eager-first-poll" | "queued";
  readonly onCompleteRef?: FunctionReference<
    "mutation",
    "internal",
    {
      readonly workflowId: string;
      readonly context: WorkflowOnCompleteContext;
      readonly result:
        | { readonly kind: "success"; readonly returnValue: unknown }
        | { readonly kind: "failed"; readonly error: string }
        | { readonly kind: "canceled" };
    },
    null
  >;
};

export const startWorkflowAndRecordOwnership = <
  F extends FunctionReference<"mutation", "internal">,
>(
  input: StartWorkflowOwnershipInput<F>,
): Effect.Effect<
  WorkflowId,
  unknown,
  MutationCtx | DatabaseReader | DatabaseWriter
> =>
  Effect.gen(function* () {
    const idempotencyKey = yield* validateWorkflowIdempotencyKey(
      input.idempotencyKey,
    );
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const mutationCtx = yield* MutationCtx;
    const normalizedInput = { ...input, idempotencyKey };
    const existing = yield* readExistingWorkflowRun(reader, normalizedInput);

    const existingWorkflowId = yield* handleExistingWorkflowRun(
      existing,
      normalizedInput,
    );
    if (existingWorkflowId) {
      return existingWorkflowId;
    }

    const reservationId = yield* reserveWorkflowRun(writer, normalizedInput);
    const completionContext = workflowOnCompleteContext(
      normalizedInput,
      reservationId,
    );
    if (normalizedInput.onCompleteRef) {
      yield* writer
        .table("workflowRuns")
        .patch(reservationId, { onCompleteContext: completionContext })
        .pipe(Effect.orDie);
    }
    const componentWorkflowId = yield* startComponentWorkflow(
      mutationCtx,
      normalizedInput,
      reservationId,
      completionContext,
    );
    yield* recordStartedWorkflow(writer, reservationId, componentWorkflowId);
    return componentWorkflowId;
  });

export const validateWorkflowIdempotencyKey = (idempotencyKey: string) => {
  const validation = validateCallerIdempotencyKey(idempotencyKey);

  if (validation.ok) {
    return Effect.succeed(validation.value);
  }

  return Effect.fail(
    makePublicError("VALIDATION_FAILED", validation.error.message, {
      idempotencyKey,
    }),
  );
};

const readExistingWorkflowRun = <
  F extends FunctionReference<"mutation", "internal">,
>(
  reader: Reader,
  input: StartWorkflowOwnershipInput<F>,
) =>
  reader
    .table("workflowRuns")
    .index("by_idempotency_key", (q) =>
      q
        .eq("workspaceId", input.workspaceId)
        .eq("idempotencyKey", input.idempotencyKey),
    )
    .first()
    .pipe(Effect.map(Option.getOrNull), Effect.orDie);

const handleExistingWorkflowRun = <
  F extends FunctionReference<"mutation", "internal">,
>(
  existing: ExistingWorkflowRun | null,
  input: StartWorkflowOwnershipInput<F>,
) => {
  if (existing?.componentWorkflowId) {
    return Effect.succeed(existing.componentWorkflowId as WorkflowId);
  }
  return existing
    ? Effect.fail(
        makePublicError(
          "VALIDATION_FAILED",
          "Workflow start is already reserved for this idempotency key.",
          { idempotencyKey: input.idempotencyKey },
        ),
      )
    : Effect.succeed(null);
};

export const reserveWorkflowRun = (
  writer: Writer,
  input: WorkflowRunReservationInput,
) =>
  Effect.gen(function* () {
    const reservationId = yield* writer
      .table("workflowRuns")
      .insert({
        workspaceId: input.workspaceId,
        workflowId: input.workflowId,
        workflowVersion: input.workflowVersion,
        graphJson: input.graphJson,
        status: "queued",
        idempotencyKey: input.idempotencyKey,
        startedByUserId: input.startedByUserId,
        startedAt: input.startedAt,
        completedAt: null,
        failedAt: null,
        trustReceiptId: input.trustReceiptId ?? null,
        ...optionalRunFields(input),
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("workflowRuns")
      .patch(
        reservationId,
        initialWorkflowLifecycleFields({
          workspaceId: input.workspaceId,
          workflowRunId: reservationId,
          workflowId: input.workflowId,
          workflowVersion: input.workflowVersion,
        }),
      )
      .pipe(Effect.orDie);
    return reservationId;
  });

export const initialWorkflowLifecycleFields = (input: {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
}) => {
  const state = createWorkflowLifecycleState(input);
  return {
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
    onCompleteContext: null,
  } as const;
};

const optionalRunFields = (input: WorkflowRunReservationInput) => ({
  ...definedFields({
    timeoutMs: input.timeoutMs,
    deadlineAt: input.deadlineAt,
  }),
  ...definedTextFields({
    workflowKind: input.workflowKind,
    sourceRunKind: input.sourceRunKind,
    sourceRunId: input.sourceRunId,
  }),
});

const definedFields = <Value extends Record<string, unknown>>(
  fields: Value,
): Partial<Value> =>
  Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<Value>;

const definedTextFields = <Value extends Record<string, string | undefined>>(
  fields: Value,
): Partial<Value> =>
  Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value),
  ) as Partial<Value>;

const startComponentWorkflow = <
  F extends FunctionReference<"mutation", "internal">,
>(
  mutationCtx: Mutation,
  input: StartWorkflowOwnershipInput<F>,
  workflowRunId: GenericId<"workflowRuns">,
  completionContext: WorkflowOnCompleteContext,
) =>
  Effect.promise(() => {
    const workflowArgs = input.buildWorkflowArgs
      ? input.buildWorkflowArgs(workflowRunId)
      : input.workflowArgs;
    if (workflowArgs === undefined) {
      throw makePublicError(
        "VALIDATION_FAILED",
        "Workflow start arguments are required.",
      );
    }
    return start(mutationCtx, input.workflowRef, workflowArgs, {
      ...kickoffProfileStartOptions(input.kickoffProfile),
      ...(input.onCompleteRef
        ? { onComplete: input.onCompleteRef, context: completionContext }
        : {}),
    });
  });

const workflowOnCompleteContext = <
  F extends FunctionReference<"mutation", "internal">,
>(
  input: StartWorkflowOwnershipInput<F>,
  workflowRunId: GenericId<"workflowRuns">,
): WorkflowOnCompleteContext => ({
  workspaceId: input.workspaceId,
  workflowRunId,
  workflowId: input.workflowId,
  workflowVersion: input.workflowVersion,
  generation: 0,
  generationAnchor: `${input.workflowId}@v${input.workflowVersion}:g0`,
});

export const kickoffProfileStartOptions = (
  profile: "eager-first-poll" | "queued",
): { readonly startAsync: boolean } => ({
  startAsync: profile === "queued",
});

const recordStartedWorkflow = (
  writer: Writer,
  reservationId: GenericId<"workflowRuns">,
  componentWorkflowId: WorkflowId,
) =>
  writer
    .table("workflowRuns")
    .patch(reservationId, {
      status: "running",
      componentWorkflowId,
    })
    .pipe(Effect.orDie);
