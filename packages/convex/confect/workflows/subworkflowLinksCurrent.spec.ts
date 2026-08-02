import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import { NotFound, ValidationFailed } from "../errors";

const Receipt = Schema.Struct({
  kind: Schema.Literals(["bounded-inline", "artifact-reference"]),
  measuredBytes: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  contentHash: Schema.String.pipe(
    Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  ),
  artifactId: Schema.optional(Schema.NonEmptyString),
});

const errors = Schema.Union([NotFound, ValidationFailed]);

const recoverReservation = FunctionSpec.internalQuery({
  name: "recoverReservation",
  args: () =>
    Schema.Struct({
      workspaceId: Schema.NonEmptyString,
      idempotencyKey: Schema.NonEmptyString,
    }),
  returns: () =>
    Schema.Struct({
      linkId: Id("workflowRunLinks"),
      childWorkflowRunId: Id("workflowRuns"),
    }),
  error: () => errors,
});

const persistUnresolvedSuccess = FunctionSpec.internalMutation({
  name: "persistUnresolvedSuccess",
  args: () =>
    Schema.Struct({
      workspaceId: Schema.NonEmptyString,
      linkId: Id("workflowRunLinks"),
      receipt: Receipt,
      childResult: Schema.Unknown,
      occurredAt: Schema.Number.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      ),
    }),
  returns: () => Schema.Null,
  error: () => errors,
});

const persistUnresolvedReservation = FunctionSpec.internalMutation({
  name: "persistUnresolvedReservation",
  args: () =>
    Schema.Struct({
      workspaceId: Schema.NonEmptyString,
      linkId: Id("workflowRunLinks"),
      idempotencyKey: Schema.NonEmptyString,
      occurredAt: Schema.Number.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      ),
    }),
  returns: () => Schema.Null,
  error: () => errors,
});

const recoverUnresolvedSuccess = FunctionSpec.internalQuery({
  name: "recoverUnresolvedSuccess",
  args: () =>
    Schema.Struct({
      workspaceId: Schema.NonEmptyString,
      linkId: Id("workflowRunLinks"),
    }),
  returns: () =>
    Schema.NullOr(
      Schema.Struct({ receipt: Receipt, childResult: Schema.Unknown }),
    ),
  error: () => errors,
});

const resolveUnresolvedSuccess = FunctionSpec.internalMutation({
  name: "resolveUnresolvedSuccess",
  args: () =>
    Schema.Struct({
      workspaceId: Schema.NonEmptyString,
      linkId: Id("workflowRunLinks"),
      occurredAt: Schema.Number.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      ),
    }),
  returns: () => Schema.Null,
  error: () => errors,
});

const reportReconciliationFailure = FunctionSpec.internalMutation({
  name: "reportReconciliationFailure",
  args: () =>
    Schema.Struct({
      workspaceId: Schema.NonEmptyString,
      linkId: Id("workflowRunLinks"),
      primaryOutcome: Schema.Literals(["succeeded", "failed", "canceled"]),
      issue: Schema.Literals([
        "SUBWORKFLOW_LINK_RECONCILIATION_FAILED",
        "SUBWORKFLOW_SUCCESS_RECONCILIATION_FAILED",
        "SUBWORKFLOW_RESERVATION_RESPONSE_INVALID",
      ]),
      occurredAt: Schema.Number.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      ),
    }),
  returns: () => Schema.Null,
  error: () => errors,
});

export default GroupSpec.make()
  .addFunction(recoverReservation)
  .addFunction(persistUnresolvedReservation)
  .addFunction(persistUnresolvedSuccess)
  .addFunction(recoverUnresolvedSuccess)
  .addFunction(resolveUnresolvedSuccess)
  .addFunction(reportReconciliationFailure);
