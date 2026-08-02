import * as Data from "effect/Data";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import {
  WorkflowEffectGuardResult,
  WorkflowEffectReconciliationState,
  WorkflowEffectReservationState,
  WorkflowEffectStrategy,
  type WorkflowEffectStrategy as WorkflowEffectStrategyType,
} from "../../tables/workflowEffectReservations";
import { WorkflowCapabilityReference } from "./workflowReferences";

const WorkflowEffectGuardPosture = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("required"),
    evidenceRef: Schema.NonEmptyString,
  }),
  Schema.Struct({
    kind: Schema.Literal("not-applicable"),
    reason: Schema.NonEmptyString,
  }),
]);

const WorkflowEffectGuards = Schema.Struct({
  approval: WorkflowEffectGuardPosture,
  quotaRate: WorkflowEffectGuardPosture,
  spendKillSwitch: WorkflowEffectGuardPosture,
});

const commonContractFields = {
  effectClass: Schema.Literal("external"),
  redactionPolicyRef: Schema.NonEmptyString,
  guards: WorkflowEffectGuards,
} as const;

const retryWindowFields = {
  dedupeRetentionMs: Schema.Number,
  maxRetryWindowMs: Schema.Number,
  maxRestartWindowMs: Schema.Number,
} as const;

export const ProviderNativeEffectContract = Schema.Struct({
  ...commonContractFields,
  ...retryWindowFields,
  strategy: Schema.Literal("provider-native"),
  keyArgumentPath: Schema.NonEmptyString,
  providerEvidenceRef: Schema.NonEmptyString,
  duplicateDeliveryFixtureRef: Schema.NonEmptyString,
  ambiguityResolution: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("exact-provider-key-replay") }),
    Schema.Struct({
      kind: Schema.Literal("provider-status-reconciliation"),
      capabilityRef: WorkflowCapabilityReference,
      fixtureRef: Schema.NonEmptyString,
    }),
  ]),
});

export const DurableLedgerEffectContract = Schema.Struct({
  ...commonContractFields,
  ...retryWindowFields,
  strategy: Schema.Literal("durable-ledger-and-reconcile"),
  reconciliationCapabilityRef: WorkflowCapabilityReference,
  reconciliationFixtureRef: Schema.NonEmptyString,
});

export const NonRetriableEffectContract = Schema.Struct({
  ...commonContractFields,
  strategy: Schema.Literal("non-retriable"),
  reason: Schema.NonEmptyString,
  ambiguousOutcome: Schema.Literal("manual-review"),
});

export const WorkflowEffectContract = Schema.Union([
  ProviderNativeEffectContract,
  DurableLedgerEffectContract,
  NonRetriableEffectContract,
]);

export type WorkflowEffectContract = Schema.Schema.Type<
  typeof WorkflowEffectContract
>;

export const decodeWorkflowEffectContract = Schema.decodeUnknownExit(
  WorkflowEffectContract,
  { errors: "all", onExcessProperty: "error" },
);

export type WorkflowActionRetry = {
  readonly maxAttempts: number;
  readonly initialBackoffMs: number;
  readonly base: number;
};

export class WorkflowEffectContractError extends Data.TaggedError(
  "WorkflowEffectContractError",
)<{ readonly issue: string }> {}

export const validateWorkflowEffectContract = (
  input: unknown,
  retry?: WorkflowActionRetry,
): Result.Result<WorkflowEffectContract, WorkflowEffectContractError> => {
  const decoded = decodeWorkflowEffectContract(input);
  if (Exit.isFailure(decoded)) {
    return Result.fail(
      new WorkflowEffectContractError({
        issue: "effect contract schema mismatch",
      }),
    );
  }
  const contract = decoded.value;
  if (retry !== undefined && !validRetry(retry)) {
    return Result.fail(
      new WorkflowEffectContractError({ issue: "invalid action retry policy" }),
    );
  }
  if (contract.strategy === "non-retriable") {
    return retry !== undefined && retry.maxAttempts > 1
      ? Result.fail(
          new WorkflowEffectContractError({
            issue: "non-retriable effects permit exactly one attempt",
          }),
        )
      : Result.succeed(contract);
  }
  const requiredRetention =
    contract.maxRetryWindowMs + contract.maxRestartWindowMs;
  if (
    ![
      contract.dedupeRetentionMs,
      contract.maxRetryWindowMs,
      contract.maxRestartWindowMs,
    ].every((value) => Number.isFinite(value) && value >= 0)
  ) {
    return Result.fail(
      new WorkflowEffectContractError({
        issue: "retry and dedupe horizons must be finite and nonnegative",
      }),
    );
  }
  if (contract.dedupeRetentionMs < requiredRetention) {
    return Result.fail(
      new WorkflowEffectContractError({
        issue: `dedupeRetentionMs must cover maxRetryWindowMs plus maxRestartWindowMs (${requiredRetention})`,
      }),
    );
  }
  return Result.succeed(contract);
};

const validRetry = (retry: WorkflowActionRetry): boolean =>
  Number.isFinite(retry.maxAttempts) &&
  Number.isInteger(retry.maxAttempts) &&
  retry.maxAttempts >= 1 &&
  Number.isFinite(retry.initialBackoffMs) &&
  retry.initialBackoffMs >= 0 &&
  Number.isFinite(retry.base) &&
  retry.base >= 1;

export const LogicalEffectKey = Schema.NonEmptyString.pipe(
  Schema.brand("LogicalEffectKey"),
);

export type LogicalEffectKey = Schema.Schema.Type<typeof LogicalEffectKey>;

export type LogicalEffectIdentity = {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly workflowVersion: number;
  readonly generation: number;
  readonly stepName: string;
  readonly instanceKey: string;
};

export const deriveLogicalEffectKey = (
  identity: LogicalEffectIdentity,
): LogicalEffectKey =>
  Schema.decodeSync(LogicalEffectKey)(
    [
      "effect.v1",
      identity.workspaceId,
      identity.workflowRunId,
      String(identity.workflowVersion),
      identity.stepName,
      identity.instanceKey,
    ]
      .map(lengthPrefixed)
      .join("|"),
  );

const lengthPrefixed = (value: string): string => `${value.length}:${value}`;

export type WorkflowEffectState = {
  readonly state: Schema.Schema.Type<typeof WorkflowEffectReservationState>;
  readonly reconciliationState: Schema.Schema.Type<
    typeof WorkflowEffectReconciliationState
  >;
};

export const initialWorkflowEffectState: WorkflowEffectState = {
  state: "reserved",
  reconciliationState: "not-required",
};

export type WorkflowEffectTransition =
  | { readonly kind: "submitted" }
  | { readonly kind: "confirmed" }
  | {
      readonly kind: "ambiguous";
      readonly phase: "before-dispatch" | "after-dispatch";
    }
  | { readonly kind: "reconciled-confirmed" }
  | { readonly kind: "manual-review" }
  | { readonly kind: "terminal" };

export class WorkflowEffectTransitionError extends Data.TaggedError(
  "WorkflowEffectTransitionError",
)<{
  readonly state: WorkflowEffectState["state"];
  readonly event: WorkflowEffectTransition["kind"];
}> {}

export const transitionWorkflowEffectState = (
  current: WorkflowEffectState,
  event: WorkflowEffectTransition,
  ambiguityStrategy?: WorkflowEffectStrategyType,
): Result.Result<WorkflowEffectState, WorkflowEffectTransitionError> => {
  if (event.kind === "ambiguous" && ambiguityStrategy === undefined) {
    return Result.fail(
      new WorkflowEffectTransitionError({
        state: current.state,
        event: event.kind,
      }),
    );
  }
  if (
    event.kind === "ambiguous" &&
    ((event.phase === "before-dispatch" && current.state !== "reserved") ||
      (event.phase === "after-dispatch" && current.state !== "submitted"))
  ) {
    return Result.fail(
      new WorkflowEffectTransitionError({
        state: current.state,
        event: event.kind,
      }),
    );
  }
  const next = transitionTable[current.state]?.[event.kind]?.(
    event.kind === "ambiguous"
      ? {
          ...event,
          ...(ambiguityStrategy === undefined
            ? {}
            : { strategy: ambiguityStrategy }),
        }
      : event,
  );
  return next === undefined
    ? Result.fail(
        new WorkflowEffectTransitionError({
          state: current.state,
          event: event.kind,
        }),
      )
    : Result.succeed(next);
};

type TransitionResolver = (
  event: WorkflowEffectTransition & {
    readonly strategy?: WorkflowEffectStrategyType;
  },
) => WorkflowEffectState;

const transitionTable: Partial<
  Record<
    WorkflowEffectState["state"],
    Partial<Record<WorkflowEffectTransition["kind"], TransitionResolver>>
  >
> = {
  reserved: {
    submitted: () => ({
      state: "submitted",
      reconciliationState: "not-required",
    }),
    terminal: () => ({ state: "terminal", reconciliationState: "terminal" }),
    ambiguous: (event) => ({
      state: "ambiguous",
      reconciliationState:
        event.kind === "ambiguous" && event.strategy === "non-retriable"
          ? "manual-review"
          : "pending",
    }),
  },
  submitted: {
    confirmed: () => ({
      state: "confirmed",
      reconciliationState: "confirmed",
    }),
    ambiguous: (event) => ({
      state: "ambiguous",
      reconciliationState:
        event.kind === "ambiguous" && event.strategy === "non-retriable"
          ? "manual-review"
          : "pending",
    }),
    terminal: () => ({ state: "terminal", reconciliationState: "terminal" }),
  },
  ambiguous: {
    "reconciled-confirmed": () => ({
      state: "confirmed",
      reconciliationState: "confirmed",
    }),
    "manual-review": () => ({
      state: "terminal",
      reconciliationState: "manual-review",
    }),
    terminal: () => ({ state: "terminal", reconciliationState: "terminal" }),
  },
};

export type WorkflowEffectGuardResults = {
  readonly approval: Schema.Schema.Type<typeof WorkflowEffectGuardResult>;
  readonly quotaRate: Schema.Schema.Type<typeof WorkflowEffectGuardResult>;
  readonly spendKillSwitch: Schema.Schema.Type<
    typeof WorkflowEffectGuardResult
  >;
};

export type WorkflowEffectDispatchPlan =
  | { readonly kind: "dispatch" }
  | {
      readonly kind: "deny";
      readonly guard: keyof WorkflowEffectGuardResults;
    }
  | { readonly kind: "reconcile" }
  | { readonly kind: "manual-review" }
  | { readonly kind: "reuse-confirmed" }
  | { readonly kind: "terminal" }
  | { readonly kind: "in-flight" };

export const planWorkflowEffectDispatch = ({
  state,
  guardResults,
  ownsReservation,
  observedAt,
  dedupeExpiresAt,
}: {
  readonly state: WorkflowEffectState;
  readonly guardResults: WorkflowEffectGuardResults;
  readonly ownsReservation: boolean;
  readonly observedAt?: number;
  readonly dedupeExpiresAt?: number;
}): WorkflowEffectDispatchPlan => {
  for (const guard of guardOrder) {
    if (guardResults[guard] === "denied") return { kind: "deny", guard };
  }
  if (
    observedAt !== undefined &&
    dedupeExpiresAt !== undefined &&
    observedAt > dedupeExpiresAt
  ) {
    return { kind: "manual-review" };
  }
  if (state.state === "reserved")
    return ownsReservation ? { kind: "dispatch" } : { kind: "in-flight" };
  if (state.state === "submitted") return { kind: "in-flight" };
  if (state.state === "confirmed") return { kind: "reuse-confirmed" };
  if (state.state === "terminal") return { kind: "terminal" };
  return state.reconciliationState === "manual-review"
    ? { kind: "manual-review" }
    : { kind: "reconcile" };
};

const guardOrder = [
  "approval",
  "quotaRate",
  "spendKillSwitch",
] as const satisfies readonly (keyof WorkflowEffectGuardResults)[];

export { WorkflowEffectStrategy };
