import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export const WorkflowEffectStrategy = Schema.Literals([
  "provider-native",
  "durable-ledger-and-reconcile",
  "non-retriable",
]);

export type WorkflowEffectStrategy = Schema.Schema.Type<
  typeof WorkflowEffectStrategy
>;

export const WorkflowEffectReservationState = Schema.Literals([
  "reserved",
  "submitted",
  "confirmed",
  "ambiguous",
  "terminal",
]);

export type WorkflowEffectReservationState = Schema.Schema.Type<
  typeof WorkflowEffectReservationState
>;

export const WorkflowEffectReconciliationState = Schema.Literals([
  "not-required",
  "pending",
  "confirmed",
  "manual-review",
  "terminal",
]);

export const WorkflowEffectGuardResult = Schema.Literals([
  "passed",
  "denied",
  "not-applicable",
]);

/**
 * Append-only evidence for a logical external effect. Provider correlation is
 * hashed/redacted before this boundary; raw request or response payloads have
 * no representable field.
 */
export const WorkflowEffectReservationRow = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowRunId: Schema.NonEmptyString,
  workflowId: Schema.NonEmptyString,
  workflowVersion: Schema.Number,
  generation: Schema.Number,
  stepName: Schema.NonEmptyString,
  logicalEffectKey: Schema.NonEmptyString,
  capabilityRef: Schema.NonEmptyString,
  effectClass: Schema.Literal("external"),
  strategy: WorkflowEffectStrategy,
  state: WorkflowEffectReservationState,
  reconciliationState: WorkflowEffectReconciliationState,
  approvalCheck: WorkflowEffectGuardResult,
  quotaRateCheck: WorkflowEffectGuardResult,
  spendKillSwitchCheck: WorkflowEffectGuardResult,
  providerCorrelationHash: Schema.optional(Schema.NonEmptyString),
  dedupeExpiresAt: Schema.Number,
  restartSafeUntil: Schema.Number,
  occurredAt: Schema.Number,
  occurredAtDescending: Schema.Number,
  appendOnly: Schema.Literal(true),
});

export type WorkflowEffectReservationRow = Schema.Schema.Type<
  typeof WorkflowEffectReservationRow
>;

export const decodeWorkflowEffectReservationRow = Schema.decodeUnknownExit(
  WorkflowEffectReservationRow,
  { errors: "all", onExcessProperty: "error" },
);

export default Table.make(() => WorkflowEffectReservationRow)
  .index("by_workspace_effect", [
    "workspaceId",
    "logicalEffectKey",
    "occurredAtDescending",
  ])
  .index("by_workspace_state_expiry", [
    "workspaceId",
    "state",
    "dedupeExpiresAt",
  ])
  .index("by_run_generation_step", ["workflowRunId", "generation", "stepName"]);
