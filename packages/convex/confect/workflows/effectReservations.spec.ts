import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import workflowEffectReservations from "../_generated/tables/workflowEffectReservations";
import { NotFound, ValidationFailed } from "../errors";
import {
  WorkflowEffectGuardResult,
  WorkflowEffectStrategy,
} from "../tables/workflowEffectReservations";

const WorkflowEffectError = Schema.Union([NotFound, ValidationFailed]);

export const WorkflowEffectTransitionEvent = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("submitted") }),
  Schema.Struct({ kind: Schema.Literal("confirmed") }),
  Schema.Struct({
    kind: Schema.Literal("ambiguous"),
    phase: Schema.Literals(["before-dispatch", "after-dispatch"]),
  }),
  Schema.Struct({ kind: Schema.Literal("reconciled-confirmed") }),
  Schema.Struct({ kind: Schema.Literal("manual-review") }),
  Schema.Struct({ kind: Schema.Literal("terminal") }),
]);

export const ReserveWorkflowEffectArgs = Schema.Struct({
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
  approvalCheck: WorkflowEffectGuardResult,
  quotaRateCheck: WorkflowEffectGuardResult,
  spendKillSwitchCheck: WorkflowEffectGuardResult,
  dedupeExpiresAt: Schema.Number,
  restartSafeUntil: Schema.Number,
  occurredAt: Schema.Number,
});

const WorkflowEffectDispatchDecision = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("dispatch") }),
  Schema.Struct({
    kind: Schema.Literal("deny"),
    guard: Schema.Literals(["approval", "quotaRate", "spendKillSwitch"]),
  }),
  Schema.Struct({ kind: Schema.Literal("reconcile") }),
  Schema.Struct({ kind: Schema.Literal("manual-review") }),
  Schema.Struct({ kind: Schema.Literal("reuse-confirmed") }),
  Schema.Struct({ kind: Schema.Literal("terminal") }),
  Schema.Struct({ kind: Schema.Literal("in-flight") }),
]);

const WorkflowEffectStateResult = Schema.Struct({
  state: Schema.Literals([
    "reserved",
    "submitted",
    "confirmed",
    "ambiguous",
    "terminal",
  ]),
  reconciliationState: Schema.Literals([
    "not-required",
    "pending",
    "confirmed",
    "manual-review",
    "terminal",
  ]),
});

const ReserveWorkflowEffectReturns = Schema.Struct({
  ...WorkflowEffectStateResult.fields,
  decision: WorkflowEffectDispatchDecision,
});

export const TransitionWorkflowEffectArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  logicalEffectKey: Schema.NonEmptyString,
  event: WorkflowEffectTransitionEvent,
  occurredAt: Schema.Number,
  providerCorrelationHash: Schema.optional(Schema.NonEmptyString),
});

const WorkflowEffectHistoryArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  logicalEffectKey: Schema.NonEmptyString,
  limit: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0)),
    Schema.check(Schema.isLessThanOrEqualTo(100)),
  ),
});

const reserve = FunctionSpec.internalMutation({
  name: "reserve",
  args: () => ReserveWorkflowEffectArgs,
  returns: () => ReserveWorkflowEffectReturns,
  error: () => WorkflowEffectError,
});

const transition = FunctionSpec.internalMutation({
  name: "transition",
  args: () => TransitionWorkflowEffectArgs,
  returns: () => WorkflowEffectStateResult,
  error: () => WorkflowEffectError,
});

const history = FunctionSpec.internalQuery({
  name: "history",
  args: () => WorkflowEffectHistoryArgs,
  returns: () => Schema.Array(workflowEffectReservations.Doc),
  error: () => WorkflowEffectError,
});

export default GroupSpec.make()
  .addFunction(reserve)
  .addFunction(transition)
  .addFunction(history);
