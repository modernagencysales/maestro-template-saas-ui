import { start, type WorkflowId } from "@convex-dev/workflow";
import {
  componentsGeneric,
  type FunctionArgs,
  type FunctionReference,
  type GenericDataModel,
  type GenericMutationCtx,
  makeFunctionReference,
} from "convex/server";
import type { GenericId, Value } from "convex/values";
import type * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "../../_generated/services";
import { ValidationFailed } from "../../errors";
import { validateCallerIdempotencyKey } from "../../shared/idempotencyKey";
import { sha256Hex } from "../../shared/sha256";
import {
  createWorkflowLifecycleState,
  type WorkflowOnCompleteContext,
} from "./lifecycleState";
import {
  assertWorkflowStartBinding,
  type PublicationRegistry,
} from "./publication";
import type { DurableWorkflowPrincipal } from "./principal";
import type { WorkflowPolicySnapshot } from "./policySnapshot";
import {
  workflowAdmissionPolicy,
  WorkflowAdmissionDenied,
  type WorkflowAdmissionLane,
  type WorkflowAdmissionPolicy,
} from "./workflowAdmission";
import { generatedWorkflowReadyWaveLimit } from "./workpoolConfig";
import { kickoffProfileStartOptions } from "./kickoffProfiles";

export { kickoffProfileStartOptions } from "./kickoffProfiles";

type Reader = Context.Service.Shape<typeof DatabaseReader>;
type Writer = Context.Service.Shape<typeof DatabaseWriter>;
type Mutation = Context.Service.Shape<typeof MutationCtx>;
type ExistingWorkflowRun = {
  readonly componentWorkflowId?: string | null | undefined;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly admissionLane?: WorkflowAdmissionLane | null | undefined;
  readonly startBindingHash?: string | null | undefined;
};

const scheduleDeadlineRef = makeFunctionReference<"mutation">(
  "workflows/deadlinesCurrent:schedule",
);
class AdmissionComponentMutationFailed extends Data.TaggedError(
  "AdmissionComponentMutationFailed",
)<{ readonly cause: unknown }> {}

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
> & {
  readonly admissionLane?: WorkflowAdmissionLane;
  readonly startBindingHash?: string;
  readonly principalSnapshot?: DurableWorkflowPrincipal;
  readonly policySnapshot?: WorkflowPolicySnapshot;
};

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
  readonly principalSnapshot?: DurableWorkflowPrincipal;
  readonly policySnapshot?: WorkflowPolicySnapshot;
  readonly publication?: {
    readonly registry: PublicationRegistry;
    readonly graphHash: string;
    readonly runnerModule: string;
    readonly runnerFunctionReference: string;
    readonly releaseChecksum: string;
  };
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
    if (input.publication) {
      assertWorkflowStartBinding(input.publication.registry, {
        workflowId: input.workflowId,
        workflowVersion: input.workflowVersion,
        graphHash: input.publication.graphHash,
        runnerRef: input.workflowRef,
        runnerModule: input.publication.runnerModule,
        runnerFunctionReference: input.publication.runnerFunctionReference,
        releaseChecksum: input.publication.releaseChecksum,
        kickoffProfile: input.kickoffProfile,
      });
    }
    const idempotencyKey = yield* validateWorkflowIdempotencyKey(
      input.idempotencyKey,
    );
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const mutationCtx = yield* MutationCtx;
    const normalizedInput = {
      ...input,
      idempotencyKey,
      admissionLane: workflowAdmissionLaneForPrincipal(input.principalSnapshot),
      startBindingHash: workflowStartBindingHash(input, idempotencyKey),
    };
    const existing = yield* readExistingWorkflowRun(reader, normalizedInput);

    const existingWorkflowId = yield* handleExistingWorkflowRun(
      existing,
      normalizedInput,
    );
    if (existingWorkflowId) {
      return existingWorkflowId;
    }

    yield* reserveWorkflowAdmission(mutationCtx, reader, {
      reservationKey: normalizedInput.idempotencyKey,
      workspaceId: normalizedInput.workspaceId,
      lane: normalizedInput.admissionLane,
    });

    const reservationId = yield* reserveWorkflowRun(writer, normalizedInput);
    yield* bindWorkflowAdmission(
      mutationCtx,
      normalizedInput.workspaceId,
      normalizedInput.idempotencyKey,
      reservationId,
    );
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
    yield* recordStartedWorkflow(
      writer,
      reservationId,
      componentWorkflowId,
      normalizedInput.kickoffProfile,
    );
    if (normalizedInput.kickoffProfile === "eager-first-poll") {
      yield* transitionWorkflowAdmission(mutationCtx, reservationId, "running");
    }
    const deadlineHorizon = yield* workflowDeadlineHorizon(normalizedInput);
    if (deadlineHorizon !== null) {
      yield* Effect.tryPromise({
        try: () =>
          mutationCtx.runMutation(scheduleDeadlineRef, {
            workspaceId: normalizedInput.workspaceId,
            workflowRunId: reservationId,
            requestedAt: normalizedInput.startedAt,
            horizonMs: deadlineHorizon,
          }),
        catch: () =>
          new ValidationFailed({
            field: "deadline",
            message: "Workflow deadline could not be scheduled.",
          }),
      });
    }
    return componentWorkflowId;
  });

const workflowDeadlineHorizon = (
  input: Pick<
    WorkflowRunReservationInput,
    "startedAt" | "timeoutMs" | "deadlineAt"
  >,
): Effect.Effect<number | null, ValidationFailed> => {
  if (input.timeoutMs !== undefined) {
    if (
      input.deadlineAt !== undefined &&
      input.deadlineAt !== input.startedAt + input.timeoutMs
    ) {
      return Effect.fail(
        new ValidationFailed({
          field: "deadline",
          message: "Workflow deadline does not match its timeout horizon.",
        }),
      );
    }
    return Effect.succeed(input.timeoutMs);
  }
  return Effect.succeed(
    input.deadlineAt === undefined ? null : input.deadlineAt - input.startedAt,
  );
};

export const validateWorkflowIdempotencyKey = (idempotencyKey: string) => {
  const validation = validateCallerIdempotencyKey(idempotencyKey);

  if (validation.ok) {
    return Effect.succeed(validation.value);
  }

  return Effect.fail(
    new ValidationFailed({
      field: "idempotencyKey",
      message: validation.error.message,
    }),
  );
};

const readExistingWorkflowRun = <
  F extends FunctionReference<"mutation", "internal">,
>(
  reader: Reader,
  input: StartWorkflowOwnershipInput<F>,
) =>
  Effect.gen(function* () {
    const run = yield* reader
      .table("workflowRuns")
      .index("by_idempotency_key", (q) =>
        q
          .eq("workspaceId", input.workspaceId)
          .eq("idempotencyKey", input.idempotencyKey),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (run === null) return null;
    const admission = yield* readWorkflowAdmission(reader, run._id);
    return {
      ...run,
      admissionLane: admission?.admissionLane,
      startBindingHash: admission?.startBindingHash,
    };
  });

export const handleExistingWorkflowRun = <
  F extends FunctionReference<"mutation", "internal">,
>(
  existing: ExistingWorkflowRun | null,
  input: StartWorkflowOwnershipInput<F> & {
    readonly admissionLane: WorkflowAdmissionLane;
    readonly startBindingHash: string;
  },
) => {
  if (existing !== null && !sameWorkflowStartBinding(existing, input)) {
    return Effect.fail(
      new ValidationFailed({
        field: "idempotencyKey",
        message: "Idempotency key conflicts with an immutable workflow start.",
      }),
    );
  }
  if (existing?.componentWorkflowId) {
    return Effect.succeed(existing.componentWorkflowId as WorkflowId);
  }
  return existing
    ? Effect.fail(
        new ValidationFailed({
          field: "idempotencyKey",
          message: "Workflow start is already reserved.",
        }),
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
        principalSnapshot: input.principalSnapshot ?? null,
        policySnapshot: input.policySnapshot ?? null,
        ...optionalRunFields(input),
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("workflowRunEvents")
      .insert({
        workflowRunId: reservationId,
        sequence: input.startedAt,
        type: workflowAdmissionReservationEventType,
        nodeId: null,
        payloadJson: JSON.stringify({
          workspaceId: input.workspaceId,
          admissionLane: resolveReservationAdmissionLane(input),
          startBindingHash: input.startBindingHash ?? null,
        }),
        createdAt: input.startedAt,
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

const resolveReservationAdmissionLane = (input: {
  readonly admissionLane?: WorkflowAdmissionLane;
  readonly principalSnapshot?: DurableWorkflowPrincipal;
}): WorkflowAdmissionLane =>
  input.principalSnapshot === undefined
    ? (input.admissionLane ?? "user")
    : workflowAdmissionLaneForPrincipal(input.principalSnapshot);

export const workflowAdmissionLaneForPrincipal = (
  principal: DurableWorkflowPrincipal | undefined,
): WorkflowAdmissionLane => (principal?.kind === "system" ? "system" : "user");

export const workflowStartBindingHash = <
  F extends FunctionReference<"mutation", "internal">,
>(
  input: StartWorkflowOwnershipInput<F>,
  idempotencyKey: string,
): string =>
  sha256Hex(
    canonicalStartValue({
      workspaceId: input.workspaceId,
      workflowId: input.workflowId,
      workflowVersion: input.workflowVersion,
      graphJson: input.graphJson,
      kickoffProfile: input.kickoffProfile,
      idempotencyKey,
      workflowArgs: input.buildWorkflowArgs
        ? input.buildWorkflowArgs("__workflow_start_binding__")
        : input.workflowArgs,
      principal: stablePrincipalIntent(input.principalSnapshot),
      policy: stablePolicyIntent(input.policySnapshot),
      admissionLane: workflowAdmissionLaneForPrincipal(input.principalSnapshot),
    }),
  );

const stablePrincipalIntent = (
  principal: DurableWorkflowPrincipal | undefined,
): unknown => {
  if (principal === undefined) return null;
  return principal.kind === "user"
    ? {
        version: principal.version,
        kind: principal.kind,
        workspaceId: principal.workspaceId,
        actorId: principal.actorId,
        role: principal.role,
        grants: principal.grants,
        authEpoch: principal.authEpoch,
        provenance: principal.provenance,
      }
    : {
        version: principal.version,
        kind: principal.kind,
        workspaceId: principal.workspaceId,
        systemId: principal.systemId,
        reason: principal.reason,
        grants: principal.grants,
        provenance: principal.provenance,
      };
};

const stablePolicyIntent = (
  policy: WorkflowPolicySnapshot | undefined,
): unknown => {
  if (policy === undefined) return null;
  if (policy.kind === "none") return policy;
  return {
    version: policy.version,
    kind: policy.kind,
    schemaName: policy.schemaName,
    policyVersionId: policy.policyVersionId,
    policyHash: policy.policyHash,
  };
};

export const sameWorkflowStartBinding = (
  existing: ExistingWorkflowRun,
  input: {
    readonly workflowId: string;
    readonly workflowVersion: number;
    readonly admissionLane: WorkflowAdmissionLane;
    readonly startBindingHash: string;
  },
): boolean =>
  existing.workflowId === input.workflowId &&
  existing.workflowVersion === input.workflowVersion &&
  (existing.admissionLane ?? "user") === input.admissionLane &&
  existing.startBindingHash === input.startBindingHash;

const workflowAdmissionReservationEventType = "workflow.admission.reserved.v1";

const readWorkflowAdmission = (
  reader: Reader,
  workflowRunId: GenericId<"workflowRuns">,
) =>
  reader
    .table("workflowRunEvents")
    .index("by_run_type", (q) =>
      q
        .eq("workflowRunId", workflowRunId)
        .eq("type", workflowAdmissionReservationEventType),
    )
    .first()
    .pipe(
      Effect.map(Option.getOrNull),
      Effect.orDie,
      Effect.map((event) => decodeWorkflowAdmission(event?.payloadJson)),
    );

const decodeWorkflowAdmission = (
  payloadJson: string | undefined,
): {
  readonly admissionLane: WorkflowAdmissionLane;
  readonly startBindingHash: string | null;
} | null => {
  if (payloadJson === undefined) return null;
  try {
    const value: unknown = JSON.parse(payloadJson);
    if (
      typeof value !== "object" ||
      value === null ||
      !("admissionLane" in value) ||
      (value.admissionLane !== "user" && value.admissionLane !== "system") ||
      !("startBindingHash" in value) ||
      (value.startBindingHash !== null &&
        typeof value.startBindingHash !== "string")
    ) {
      return null;
    }
    return {
      admissionLane: value.admissionLane,
      startBindingHash: value.startBindingHash,
    };
  } catch {
    return null;
  }
};

const canonicalStartValue = (value: unknown): string => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStartValue).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${canonicalStartValue(entry)}`,
      )
      .join(",")}}`;
  }
  throw new TypeError("Workflow start arguments are not canonical values.");
};

type AdmissionRunStatus =
  "queued" | "running" | "completed" | "failed" | "canceled" | "timedOut";
type AdmissionComponentReference = FunctionReference<
  "mutation",
  "public",
  Record<string, Value>,
  Value | null
>;
type AdmissionComponent = {
  reserve: AdmissionComponentReference;
  bind: AdmissionComponentReference;
  transition: AdmissionComponentReference;
};
const admissionComponents = componentsGeneric() as unknown as Record<
  string,
  Record<string, AdmissionComponent>
>;
const registeredAdmissionComponent =
  admissionComponents.workflowAdmission?.admission;
if (registeredAdmissionComponent === undefined) {
  throw new TypeError("Workflow admission component is not registered.");
}
const admissionComponent: AdmissionComponent = registeredAdmissionComponent;

export const reserveWorkflowAdmission = (
  mutation: Mutation,
  reader: Reader,
  input: {
    workspaceId: string;
    reservationKey: string;
    lane: WorkflowAdmissionLane;
    policy?: WorkflowAdmissionPolicy;
  },
) =>
  Effect.gen(function* () {
    const policy =
      input.policy ?? workflowAdmissionPolicy(generatedWorkflowReadyWaveLimit);
    const [legacyRunningRunIds, legacyQueuedRunIds] = yield* Effect.all([
      legacyWorkflowRunIds(
        reader,
        input.workspaceId,
        "running",
        policy.user.maxActive,
      ),
      legacyWorkflowRunIds(
        reader,
        input.workspaceId,
        "queued",
        policy.user.maxQueued,
      ),
    ]);
    yield* runAdmissionComponentMutation(mutation, admissionComponent.reserve, {
      ...input,
      policy,
      legacyRunningRunIds,
      legacyQueuedRunIds,
    });
  }).pipe(
    Effect.catch((error) => {
      const decoded = decodeAdmissionError(error);
      return decoded instanceof WorkflowAdmissionDenied
        ? Effect.fail(decoded)
        : Effect.die(decoded);
    }),
  );

export const bindWorkflowAdmission = (
  mutation: Mutation,
  workspaceId: string,
  reservationKey: string,
  workflowRunId: GenericId<"workflowRuns">,
) =>
  runAdmissionComponentMutation(mutation, admissionComponent.bind, {
    workspaceId,
    reservationKey,
    workflowRunId,
  });

export const transitionWorkflowAdmission = (
  mutation: Mutation,
  workflowRunId: GenericId<"workflowRuns">,
  status: AdmissionRunStatus,
) =>
  runAdmissionComponentMutation(mutation, admissionComponent.transition, {
    workflowRunId,
    status,
  });

const legacyWorkflowRunIds = (
  reader: Reader,
  workspaceId: string,
  status: "queued" | "running",
  limit: number,
) =>
  limit === 0
    ? Effect.succeed([] as string[])
    : reader
        .table("workflowRuns")
        .index("by_workspace_status", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", status),
        )
        .take(limit)
        .pipe(
          Effect.map((runs) => runs.map((run) => String(run._id))),
          Effect.orDie,
        );

const runAdmissionComponentMutation = (
  mutation: Mutation,
  reference: AdmissionComponentReference,
  args: Record<string, Value>,
) =>
  Effect.tryPromise({
    try: () =>
      (mutation as unknown as GenericMutationCtx<GenericDataModel>).runMutation(
        reference,
        args,
      ),
    catch: (error) => new AdmissionComponentMutationFailed({ cause: error }),
  });

export const decodeAdmissionError = (error: unknown): unknown => {
  const cause =
    error instanceof AdmissionComponentMutationFailed ? error.cause : error;
  const data =
    typeof cause === "object" && cause !== null && "data" in cause
      ? (cause as { data: unknown }).data
      : cause;
  if (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    data.code === "WORKFLOW_ADMISSION_DENIED" &&
    "lane" in data &&
    (data.lane === "user" || data.lane === "system") &&
    "saturated" in data &&
    (data.saturated === "active" || data.saturated === "queued") &&
    "active" in data &&
    typeof data.active === "number" &&
    "queued" in data &&
    typeof data.queued === "number" &&
    "limit" in data &&
    typeof data.limit === "number" &&
    "retryAfterMs" in data &&
    typeof data.retryAfterMs === "number"
  ) {
    return new WorkflowAdmissionDenied({
      lane: data.lane,
      saturated: data.saturated,
      active: data.active,
      queued: data.queued,
      limit: data.limit,
      retryAfterMs: data.retryAfterMs,
    });
  }
  return error;
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
  Effect.gen(function* () {
    const workflowArgs = input.buildWorkflowArgs
      ? input.buildWorkflowArgs(workflowRunId)
      : input.workflowArgs;
    if (workflowArgs === undefined) {
      return yield* new ValidationFailed({
        field: "workflow",
        message: "Workflow start arguments are required.",
      });
    }
    return yield* Effect.promise(() =>
      start(mutationCtx, input.workflowRef, workflowArgs, {
        ...kickoffProfileStartOptions(input.kickoffProfile),
        ...(input.onCompleteRef
          ? { onComplete: input.onCompleteRef, context: completionContext }
          : {}),
      }),
    );
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

export const recordStartedWorkflow = (
  writer: Writer,
  reservationId: GenericId<"workflowRuns">,
  componentWorkflowId: WorkflowId,
  kickoffProfile: "eager-first-poll" | "queued",
) =>
  writer
    .table("workflowRuns")
    .patch(reservationId, {
      ...(kickoffProfile === "eager-first-poll" ? { status: "running" } : {}),
      componentWorkflowId,
    })
    .pipe(Effect.orDie);

export const recordWorkflowAdmissionStatus = (
  writer: Writer,
  workflowRunId: GenericId<"workflowRuns">,
  status:
    "queued" | "running" | "completed" | "failed" | "canceled" | "timedOut",
) =>
  writer
    .table("workflowRuns")
    .patch(workflowRunId, { status })
    .pipe(Effect.orDie);
