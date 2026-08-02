import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import { NotFound, ValidationFailed } from "../errors";
import { DurableWorkflowPrincipal } from "./_kit/principal";
import { WorkflowPolicySnapshot } from "./_kit/policySnapshot";
import { MAX_SUBWORKFLOW_RESULT_BYTES } from "./_kit/subworkflowLinks";
import { WorkflowReference, WorkflowStepName } from "./_kit/workflowReferences";

export const SubworkflowRunLinkProjection = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  parentWorkflowRunId: Schema.NonEmptyString,
  parentComponentWorkflowId: Schema.NonEmptyString,
  parentWorkflowVersion: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(1)),
  ),
  generation: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  childWorkflow: WorkflowReference,
  childWorkflowVersion: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(1)),
  ),
  childGraphJson: Schema.NonEmptyString,
  childReleaseChecksum: Schema.String.pipe(
    Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  ),
  stepName: WorkflowStepName,
  principal: DurableWorkflowPrincipal,
  policySnapshot: WorkflowPolicySnapshot,
});

export const ReserveSubworkflowRunLinkArgs = Schema.Struct({
  projection: SubworkflowRunLinkProjection,
  occurredAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
});

export const ReserveSubworkflowRunLinkResult = Schema.Struct({
  linkId: Id("workflowRunLinks"),
  childWorkflowRunId: Id("workflowRuns"),
});

export const ActivateSubworkflowRunLinkArgs = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  parentWorkflowRunId: Id("workflowRuns"),
  parentComponentWorkflowId: Schema.NonEmptyString,
  childWorkflowRunId: Id("workflowRuns"),
  childComponentWorkflowId: Schema.NonEmptyString,
  generation: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  linkId: Id("workflowRunLinks"),
  occurredAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
});

export const ActivateSubworkflowRunLinkResult = Schema.Struct({
  status: Schema.Literal("running"),
  principal: DurableWorkflowPrincipal,
  policySnapshot: WorkflowPolicySnapshot,
});

export const SubworkflowRunLinkOutcome = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("succeeded"),
    receipt: Schema.Struct({
      kind: Schema.Literals(["bounded-inline", "artifact-reference"]),
      measuredBytes: Schema.Number.pipe(
        Schema.check(Schema.isInt()),
        Schema.check(Schema.isGreaterThanOrEqualTo(0)),
        Schema.check(Schema.isLessThanOrEqualTo(MAX_SUBWORKFLOW_RESULT_BYTES)),
      ),
      contentHash: Schema.String.pipe(
        Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
      ),
      artifactId: Schema.optional(Schema.NonEmptyString),
    }),
  }),
  Schema.Struct({
    kind: Schema.Literal("failed"),
    error: Schema.NonEmptyString,
  }),
  Schema.Struct({ kind: Schema.Literal("canceled") }),
]);

export const ReconcileSubworkflowRunLinkArgs = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  linkId: Id("workflowRunLinks"),
  outcome: SubworkflowRunLinkOutcome,
  occurredAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
});

export const ReconcileSubworkflowRunLinkResult = Schema.Struct({
  status: Schema.Literals(["succeeded", "failed", "canceled"]),
});

export const ReportSubworkflowReconciliationFailureArgs = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  linkId: Id("workflowRunLinks"),
  primaryOutcome: Schema.Literals(["failed", "canceled"]),
  issue: Schema.Literal("SUBWORKFLOW_LINK_RECONCILIATION_FAILED"),
  occurredAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
});

const errors = Schema.Union([NotFound, ValidationFailed]);

const reserve = FunctionSpec.internalMutation({
  name: "reserve",
  args: () => ReserveSubworkflowRunLinkArgs,
  returns: () => ReserveSubworkflowRunLinkResult,
  error: () => errors,
});

const reconcile = FunctionSpec.internalMutation({
  name: "reconcile",
  args: () => ReconcileSubworkflowRunLinkArgs,
  returns: () => ReconcileSubworkflowRunLinkResult,
  error: () => errors,
});

const activate = FunctionSpec.internalMutation({
  name: "activate",
  args: () => ActivateSubworkflowRunLinkArgs,
  returns: () => ActivateSubworkflowRunLinkResult,
  error: () => errors,
});

const reportReconciliationFailure = FunctionSpec.internalMutation({
  name: "reportReconciliationFailure",
  args: () => ReportSubworkflowReconciliationFailureArgs,
  returns: () => Schema.Null,
  error: () => errors,
});

export default GroupSpec.make()
  .addFunction(reserve)
  .addFunction(activate)
  .addFunction(reportReconciliationFailure)
  .addFunction(reconcile);
