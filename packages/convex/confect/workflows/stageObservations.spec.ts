import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

const StageKind = Schema.Literals([
  "source",
  "capability",
  "agent",
  "delay",
  "approval",
  "output",
  "subworkflow",
  "event",
]);

const Common = {
  workflowRunId: Schema.NonEmptyString,
  componentWorkflowId: Schema.NonEmptyString,
  nodeId: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
  kind: StageKind,
  stageKey: Schema.NonEmptyString,
  lifecycleGeneration: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  externalEffect: Schema.Boolean,
  observedAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  attemptNumber: Schema.optional(
    Schema.Number.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0)),
    ),
  ),
  order: Schema.optional(
    Schema.Number.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    ),
  ),
};

const recordStarted = FunctionSpec.internalMutation({
  name: "recordStarted",
  args: () => Schema.Struct({ ...Common, status: Schema.Literal("running") }),
  returns: () => Schema.Null,
});

const recordFinished = FunctionSpec.internalMutation({
  name: "recordFinished",
  args: () =>
    Schema.Struct({
      ...Common,
      status: Schema.Literals(["succeeded", "failed"]),
      outputJson: Schema.optional(Schema.String),
      errorJson: Schema.optional(Schema.String),
    }),
  returns: () => Schema.Null,
});

const executionIdentity = FunctionSpec.internalQuery({
  name: "executionIdentity",
  args: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
      workflowRunId: Id("workflowRuns"),
      componentWorkflowId: Schema.NonEmptyString,
    }),
  returns: () =>
    Schema.Struct({
      generation: Schema.Number.pipe(
        Schema.check(Schema.isInt()),
        Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      ),
      observedAt: Schema.Number.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      ),
    }),
});

export default GroupSpec.make()
  .addFunction(executionIdentity)
  .addFunction(recordStarted)
  .addFunction(recordFinished);
