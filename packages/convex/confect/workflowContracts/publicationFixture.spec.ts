import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import {
  collectContractManifest,
  collectContractSchemas,
  defineContractFunction,
} from "../capabilities/_kit/capability";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { Id } from "../_generated/id";
import { ProductWorkflowEventId } from "../workflows/_kit/events";
import { WorkflowStatusResult } from "../workflows/_kit/status";
import {
  WorkflowLifecycleRunProjection,
  WorkflowLifecycleStepProjection,
} from "../workflows/lifecycle.spec";

const WorkflowErrors = Schema.Union([
  Unauthorized,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  NotFound,
  ValidationFailed,
]);

const StartArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  idempotencyKey: Schema.String,
});

const StartReturns = Schema.Struct({
  status: Schema.Literal("queued"),
  workflow: Schema.Literal("publicationFixture"),
  workflowRunId: Id("workflowRuns"),
  componentWorkflowId: Schema.String,
});

const StatusArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  componentWorkflowId: Schema.String,
});

const LifecycleControlArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowRunId: Id("workflowRuns"),
  reasonCode: Schema.Literals([
    "operator-request",
    "recovery",
    "policy-change",
    "retention-sweep",
  ]),
  occurredAt: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
});
const Pagination = {
  cursor: Schema.NullOr(Schema.String),
  limit: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0)),
    Schema.check(Schema.isLessThanOrEqualTo(100)),
  ),
} as const;
const LifecycleRunPage = Schema.Struct({
  page: Schema.Array(WorkflowLifecycleRunProjection),
  isDone: Schema.Boolean,
  continueCursor: Schema.String,
});
const LifecycleStepPage = Schema.Struct({
  page: Schema.Array(WorkflowLifecycleStepProjection),
  isDone: Schema.Boolean,
  continueCursor: Schema.String,
});

const SendEventArgs = Schema.Struct({
  selector: Schema.Union([
    Schema.Struct({
      kind: Schema.Literal("id"),
      eventId: ProductWorkflowEventId,
    }),
    Schema.Struct({
      kind: Schema.Literal("definition"),
      componentWorkflowId: Schema.NonEmptyString,
      event: Schema.Literal("approvalDecision"),
      eventInstanceKey: Schema.NonEmptyString,
    }),
  ]),
  delivery: Schema.Union([
    Schema.Struct({
      kind: Schema.Literal("value"),
      value: Schema.Struct({ approved: Schema.Boolean }),
    }),
    Schema.Struct({
      kind: Schema.Literal("error"),
      error: Schema.NonEmptyString,
    }),
  ]),
});

const SendEventReturns = Schema.Struct({
  eventId: ProductWorkflowEventId,
  status: Schema.Literal("sent"),
});

export const startInteractive = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "startInteractive",
    args: () => StartArgs,
    returns: () => StartReturns,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.publicationFixture",
    name: "startInteractive",
    operationId: "workflows.publicationFixture.startInteractive",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "workflows.publicationFixture.startInteractive.args",
    returnsSchemaName: "workflows.publicationFixture.startInteractive.returns",
    argsSchema: StartArgs,
    returnsSchema: StartReturns,
  },
);

export const startQueued = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "startQueued",
    args: () => StartArgs,
    returns: () => StartReturns,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.publicationFixture",
    name: "startQueued",
    operationId: "workflows.publicationFixture.startQueued",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "workflows.publicationFixture.startQueued.args",
    returnsSchemaName: "workflows.publicationFixture.startQueued.returns",
    argsSchema: StartArgs,
    returnsSchema: StartReturns,
  },
);

export const status = defineContractFunction(
  FunctionSpec.publicQuery({
    name: "status",
    args: () => StatusArgs,
    returns: () => WorkflowStatusResult,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.publicationFixture",
    name: "status",
    operationId: "workflows.publicationFixture.status",
    kind: "query",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: true,
    argsSchemaName: "workflows.publicationFixture.status.args",
    returnsSchemaName: "workflows.publicationFixture.status.returns",
    argsSchema: StatusArgs,
    returnsSchema: WorkflowStatusResult,
  },
);

const lifecycleContract = <Spec>(
  spec: Spec,
  name: string,
  kind: "query" | "mutation",
  argsSchema: Schema.Top,
  returnsSchema: Schema.Top,
  idempotent: boolean,
) =>
  defineContractFunction(spec, {
    namespace: "workflows.publicationFixture",
    name,
    operationId: "workflows.publicationFixture." + name,
    kind,
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent,
    argsSchemaName: "workflows.publicationFixture." + name + ".args",
    returnsSchemaName: "workflows.publicationFixture." + name + ".returns",
    argsSchema,
    returnsSchema,
  });

const CancelReturns = Schema.Struct({
  status: Schema.Literal("canceled"),
  actionMayFinish: Schema.Literal(true),
});
export const cancel = lifecycleContract(
  FunctionSpec.publicMutation({
    name: "cancel",
    args: () => LifecycleControlArgs,
    returns: () => CancelReturns,
    error: () => WorkflowErrors,
  }),
  "cancel",
  "mutation",
  LifecycleControlArgs,
  CancelReturns,
  false,
);

const RestartArgs = Schema.Struct({
  ...LifecycleControlArgs.fields,
  restartAnchor: Schema.NonEmptyString,
});
const RestartReturns = Schema.Struct({
  generation: Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  discardedSteps: Schema.Array(Schema.NonEmptyString),
});
export const restart = lifecycleContract(
  FunctionSpec.publicMutation({
    name: "restart",
    args: () => RestartArgs,
    returns: () => RestartReturns,
    error: () => WorkflowErrors,
  }),
  "restart",
  "mutation",
  RestartArgs,
  RestartReturns,
  false,
);

const ListArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  ...Pagination,
});
export const list = lifecycleContract(
  FunctionSpec.publicQuery({
    name: "list",
    args: () => ListArgs,
    returns: () => LifecycleRunPage,
    error: () => WorkflowErrors,
  }),
  "list",
  "query",
  ListArgs,
  LifecycleRunPage,
  true,
);

const ListByNameArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowName: Schema.NonEmptyString,
  ...Pagination,
});
export const listByName = lifecycleContract(
  FunctionSpec.publicQuery({
    name: "listByName",
    args: () => ListByNameArgs,
    returns: () => LifecycleRunPage,
    error: () => WorkflowErrors,
  }),
  "listByName",
  "query",
  ListByNameArgs,
  LifecycleRunPage,
  true,
);

const ListStepsArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  workflowRunId: Id("workflowRuns"),
  ...Pagination,
});
export const listSteps = lifecycleContract(
  FunctionSpec.publicQuery({
    name: "listSteps",
    args: () => ListStepsArgs,
    returns: () => LifecycleStepPage,
    error: () => WorkflowErrors,
  }),
  "listSteps",
  "query",
  ListStepsArgs,
  LifecycleStepPage,
  true,
);

const CleanupReturns = Schema.Struct({
  status: Schema.Literal("component-cleanup-requested"),
  fullDeletionProven: Schema.Literal(false),
});
export const cleanup = lifecycleContract(
  FunctionSpec.publicMutation({
    name: "cleanup",
    args: () => LifecycleControlArgs,
    returns: () => CleanupReturns,
    error: () => WorkflowErrors,
  }),
  "cleanup",
  "mutation",
  LifecycleControlArgs,
  CleanupReturns,
  false,
);

export const sendEvent = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "sendEvent",
    args: () => SendEventArgs,
    returns: () => SendEventReturns,
    error: () => WorkflowErrors,
  }),
  {
    namespace: "workflows.publicationFixture",
    name: "sendEvent",
    operationId: "workflows.publicationFixture.sendEvent",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "workflows.publicationFixture.sendEvent.args",
    returnsSchemaName: "workflows.publicationFixture.sendEvent.returns",
    argsSchema: SendEventArgs,
    returnsSchema: SendEventReturns,
  },
);

const contractFunctions = [
  startInteractive,
  startQueued,
  status,
  cancel,
  restart,
  list,
  listByName,
  listSteps,
  cleanup,
  sendEvent,
] as const;

export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make()
  .addFunction(startInteractive.spec)
  .addFunction(startQueued.spec)
  .addFunction(status.spec)
  .addFunction(cancel.spec)
  .addFunction(restart.spec)
  .addFunction(list.spec)
  .addFunction(listByName.spec)
  .addFunction(listSteps.spec)
  .addFunction(cleanup.spec)
  .addFunction(sendEvent.spec);
