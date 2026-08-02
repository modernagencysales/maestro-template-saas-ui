import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { NotFound, ValidationFailed } from "../errors";
import type { WorkflowEffectReservationRow } from "../tables/workflowEffectReservations";
import {
  planWorkflowEffectDispatch,
  transitionWorkflowEffectState,
  type WorkflowEffectGuardResults,
  type WorkflowEffectState,
  type WorkflowEffectTransition,
} from "./_kit/effectReservations";
import effectReservations from "./effectReservations.spec";

type ReserveInput = Omit<
  WorkflowEffectReservationRow,
  | "state"
  | "reconciliationState"
  | "providerCorrelationHash"
  | "occurredAtDescending"
  | "appendOnly"
>;

const reserve = FunctionImpl.make(
  databaseSchema,
  effectReservations,
  "reserve",
  (input) =>
    Effect.gen(function* () {
      yield* validateObservationTime(input.occurredAt);
      const existing = yield* readLatest(
        input.workspaceId,
        input.logicalEffectKey,
      );
      const guardResults = guardsFrom(input);
      if (existing !== null) {
        yield* validateSameEffect(existing, input);
        const state = stateFrom(existing);
        return {
          ...state,
          decision: planWorkflowEffectDispatch({
            state,
            guardResults,
            ownsReservation: false,
            observedAt: input.occurredAt,
            dedupeExpiresAt: existing.dedupeExpiresAt,
          }),
        };
      }

      yield* validateReservationHorizon(input);

      const state: WorkflowEffectState = deniedGuard(guardResults)
        ? { state: "terminal", reconciliationState: "terminal" }
        : { state: "reserved", reconciliationState: "not-required" };
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("workflowEffectReservations")
        .insert({
          ...input,
          ...state,
          occurredAtDescending: -input.occurredAt,
          appendOnly: true,
        })
        .pipe(Effect.orDie);

      return {
        ...state,
        decision: planWorkflowEffectDispatch({
          state,
          guardResults,
          ownsReservation: true,
        }),
      };
    }),
);

const transition = FunctionImpl.make(
  databaseSchema,
  effectReservations,
  "transition",
  ({
    workspaceId,
    logicalEffectKey,
    event,
    occurredAt,
    providerCorrelationHash,
  }) =>
    Effect.gen(function* () {
      const existing = yield* readLatest(workspaceId, logicalEffectKey);
      if (existing === null) {
        return yield* new NotFound({
          resource: "workflowEffectReservations",
          id: logicalEffectKey,
        });
      }
      const transitioned = transitionWorkflowEffectState(
        stateFrom(existing),
        event as WorkflowEffectTransition,
        existing.strategy,
      );
      if (Result.isFailure(transitioned)) {
        return yield* new ValidationFailed({
          field: "event",
          message: `Invalid workflow effect transition: ${transitioned.failure.state} -> ${transitioned.failure.event}`,
        });
      }
      const next = transitioned.success;
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("workflowEffectReservations")
        .insert({
          ...copyReservation(existing),
          ...next,
          ...(providerCorrelationHash === undefined
            ? existing.providerCorrelationHash === undefined
              ? {}
              : {
                  providerCorrelationHash: existing.providerCorrelationHash,
                }
            : { providerCorrelationHash }),
          occurredAt,
          occurredAtDescending: -occurredAt,
          appendOnly: true,
        })
        .pipe(Effect.orDie);
      return next;
    }),
);

const history = FunctionImpl.make(
  databaseSchema,
  effectReservations,
  "history",
  ({ workspaceId, logicalEffectKey, limit }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      return yield* reader
        .table("workflowEffectReservations")
        .index("by_workspace_effect", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("logicalEffectKey", logicalEffectKey),
        )
        .take(limit)
        .pipe(
          Effect.map((rows) => [...rows].reverse()),
          Effect.orDie,
        );
    }),
);

const readLatest = (
  workspaceId: WorkflowEffectReservationRow["workspaceId"],
  logicalEffectKey: string,
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("workflowEffectReservations")
      .index("by_workspace_effect", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("logicalEffectKey", logicalEffectKey),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  });

const guardsFrom = (input: {
  readonly approvalCheck: WorkflowEffectGuardResults["approval"];
  readonly quotaRateCheck: WorkflowEffectGuardResults["quotaRate"];
  readonly spendKillSwitchCheck: WorkflowEffectGuardResults["spendKillSwitch"];
}): WorkflowEffectGuardResults => ({
  approval: input.approvalCheck,
  quotaRate: input.quotaRateCheck,
  spendKillSwitch: input.spendKillSwitchCheck,
});

const deniedGuard = (guards: WorkflowEffectGuardResults): boolean =>
  Object.values(guards).includes("denied");

const validateReservationHorizon = (input: ReserveInput) =>
  Number.isFinite(input.occurredAt) &&
  Number.isFinite(input.restartSafeUntil) &&
  Number.isFinite(input.dedupeExpiresAt) &&
  input.occurredAt >= 0 &&
  input.restartSafeUntil >= input.occurredAt &&
  input.dedupeExpiresAt >= input.restartSafeUntil
    ? Effect.void
    : Effect.fail(
        new ValidationFailed({
          field: "dedupeExpiresAt",
          message:
            "Reservation horizons must be finite, nonnegative, and cover the complete restart-safe window.",
        }),
      );

const validateObservationTime = (occurredAt: number) =>
  Number.isFinite(occurredAt) && occurredAt >= 0
    ? Effect.void
    : Effect.fail(
        new ValidationFailed({
          field: "occurredAt",
          message:
            "Reservation observation time must be finite and nonnegative.",
        }),
      );

const stateFrom = (row: {
  readonly state: WorkflowEffectState["state"];
  readonly reconciliationState: WorkflowEffectState["reconciliationState"];
}): WorkflowEffectState => ({
  state: row.state,
  reconciliationState: row.reconciliationState,
});

const validateSameEffect = (
  existing: WorkflowEffectReservationRow,
  input: ReserveInput,
) => {
  const mismatched = invariantFields.find(
    (field) => existing[field] !== input[field],
  );
  return mismatched === undefined
    ? Effect.void
    : Effect.fail(
        new ValidationFailed({
          field: mismatched,
          message:
            "Logical effect identity is already bound to different workflow evidence.",
        }),
      );
};

const invariantFields = [
  "workspaceId",
  "workflowRunId",
  "workflowId",
  "workflowVersion",
  "stepName",
  "logicalEffectKey",
  "capabilityRef",
  "strategy",
  "dedupeExpiresAt",
  "restartSafeUntil",
] as const satisfies readonly (keyof ReserveInput)[];

const copyReservation = (
  row: WorkflowEffectReservationRow,
): Omit<
  WorkflowEffectReservationRow,
  | "state"
  | "reconciliationState"
  | "providerCorrelationHash"
  | "occurredAt"
  | "occurredAtDescending"
  | "appendOnly"
> => ({
  workspaceId: row.workspaceId,
  workflowRunId: row.workflowRunId,
  workflowId: row.workflowId,
  workflowVersion: row.workflowVersion,
  generation: row.generation,
  stepName: row.stepName,
  logicalEffectKey: row.logicalEffectKey,
  capabilityRef: row.capabilityRef,
  effectClass: row.effectClass,
  strategy: row.strategy,
  approvalCheck: row.approvalCheck,
  quotaRateCheck: row.quotaRateCheck,
  spendKillSwitchCheck: row.spendKillSwitchCheck,
  dedupeExpiresAt: row.dedupeExpiresAt,
  restartSafeUntil: row.restartSafeUntil,
});

export default GroupImpl.make(databaseSchema, effectReservations).pipe(
  Layer.provide(reserve),
  Layer.provide(transition),
  Layer.provide(history),
  GroupImpl.finalize,
);
