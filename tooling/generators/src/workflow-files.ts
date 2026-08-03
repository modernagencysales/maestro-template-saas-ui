import { renderGeneratedWorkflowPredeploySource } from "./workflow-predeploy";

export type SystemGeneratorDisposition = "reuse" | "extend";

export type GeneratedFile = {
  readonly path: string;
  readonly content: string;
};

export type WorkflowGeneratorOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly description?: string;
  readonly write?: boolean;
};

export type WorkflowGeneratorResult = {
  readonly name: string;
  readonly pascalName: string;
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
  readonly files: readonly GeneratedFile[];
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const kebabCase = (value: string): string =>
  slugify(value.replace(/([a-z0-9])([A-Z])/g, "$1-$2"));

const pascalCase = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");

  return normalized || "GeneratedCapability";
};

const camelCase = (value: string): string => {
  const pascal = pascalCase(value);

  return `${pascal[0]?.toLowerCase() ?? "g"}${pascal.slice(1)}`;
};

const withGeneratorProvenance = (
  generator: string,
  name: string,
  files: readonly GeneratedFile[],
  ownership?: {
    readonly system: string;
    readonly disposition: SystemGeneratorDisposition;
  },
): readonly GeneratedFile[] => {
  const commandFamily = `template:${generator}`;

  return [
    ...files,
    {
      path: `docs/template/generated/provenance/${generator}/${name}.json`,
      content: `${JSON.stringify(
        {
          generator,
          commandFamily,
          name,
          ...(ownership === undefined ? {} : { ownership }),
          generatedPaths: files.map((file) => file.path),
        },
        null,
        2,
      )}\n`,
    },
  ];
};

const graphFixture = "packages/convex/test/<name>.workflow.test.ts";
const runnerFixture = "tooling/generators/src/workflow-output-smoke.ts";

const generated = (
  constructor: string,
  compiler: string,
  fixture = graphFixture,
) => ({
  posture: "generated" as const,
  constructor,
  compiler,
  fixture,
});

const guardedDefault = (constructor: string, compiler: string) => ({
  posture: "guarded-default" as const,
  constructor,
  compiler,
  fixture: "tooling/generators/src/customer-runtime.test.ts",
});

const workflowGeneratorSemanticCoverage = {
  "WF-GRAPH-ID": generated("DurableWorkflowGraph.id", "workflow release id"),
  "WF-GRAPH-VERSION": generated(
    "DurableWorkflowGraph.version",
    "immutable graph version",
  ),
  "WF-GRAPH-START": generated(
    "DurableWorkflowGraph.startNodeId",
    "source node selection",
  ),
  "WF-GRAPH-NODES": generated(
    "DurableWorkflowGraph.nodes",
    "runDurableGraphWorkflow",
  ),
  "WF-GRAPH-EDGES": generated(
    "DurableWorkflowGraph.edges",
    "ready-node traversal",
  ),
  "WF-GRAPH-JOINS": generated("DurableWorkflowGraph.joins", "join readiness"),
  "WF-NODE-ID": generated("WorkflowNode.id", "journal step identity"),
  "WF-NODE-KIND": generated("WorkflowNodeKind", "node executor lookup"),
  "WF-NODE-LABEL": generated("WorkflowNode.label", "receipt projection"),
  "WF-NODE-FUNCTION-KIND": generated(
    "workflowNode action/query/mutation constructors",
    "exact generated registry kind dispatch",
    "packages/convex/test/workflow-conformance.test.ts",
  ),
  "WF-NODE-RETRY": generated(
    "WorkflowActionNodeV2.retry with WorkflowEffectContract",
    "exact guarded runAction retry options",
  ),
  "WF-FAILURE-COMPENSATION-STEPS": generated(
    "WorkflowFailurePolicy.steps",
    "completed-node filtering and reverse-order execution",
    "packages/convex/test/workflow-conformance.test.ts",
  ),
  "WF-FAILURE-COMPENSATION-NODE": generated(
    "WorkflowCompensationStep.forNodeId",
    "completed-node filtering before compensation dispatch",
    "packages/convex/test/workflow-conformance.test.ts",
  ),
  "WF-STEP-ACTION": generated(
    "workflowNode.action with WorkflowEffectContract",
    "guarded runAction with stable name and exact retry",
    "packages/convex/test/workflow-conformance.test.ts",
  ),
  "WF-NODE-TRANSACTION": guardedDefault(
    "workflowNode query/mutation constructors",
    "independent by default; guarded inline options",
  ),
  "WF-NODE-EVENT-DEFINITION": generated(
    "defineWorkflowEvent + defineWorkflowV2EventRegistry",
    "exact generated event registry entry",
    "tooling/generators/src/customer-runtime.test.ts",
  ),
  "WF-NODE-EVENT-SCHEMA": generated(
    "WorkflowEventDefinition schema + validator",
    "shared generated await and delivery validator",
    "tooling/generators/src/customer-runtime.test.ts",
  ),
  "WF-NODE-EVENT-INSTANCE": generated(
    "WorkflowEventNodeV2.eventInstanceKey + ProductWorkflowEventId",
    "persisted owned event allocation",
    "packages/convex/test/workflow-conformance.test.ts",
  ),
  "WF-RETRY-MAX-ATTEMPTS": generated(
    "WorkflowRetryConfigV2.maxAttempts",
    "validated runAction.retry.maxAttempts",
  ),
  "WF-RETRY-BACKOFF": guardedDefault(
    "WorkflowRetryConfig.backoffMs",
    "literal zero until Phase 1 compiler support",
  ),
  "WF-RETRY-INITIAL-BACKOFF": generated(
    "WorkflowRetryConfigV2.initialBackoffMs",
    "validated runAction.retry.initialBackoffMs",
  ),
  "WF-RETRY-BASE": generated(
    "WorkflowRetryConfigV2.base",
    "validated runAction.retry.base",
  ),
  "WF-TRANSACTION-KIND": guardedDefault(
    "WorkflowIndependentTransaction | WorkflowInlineTransaction",
    "independent or guarded inline compiler branch",
  ),
  "WF-TRANSACTION-LIMITS": guardedDefault(
    "inlineTransactionPreset | reviewedInlineTransaction",
    "validated step transactionLimits",
  ),
  "WF-TRANSACTION-BYTES-READ": guardedDefault(
    "InlineTransactionLimits.bytesRead",
    "transactionLimits.bytesRead",
  ),
  "WF-TRANSACTION-BYTES-WRITTEN": guardedDefault(
    "InlineTransactionLimits.bytesWritten",
    "transactionLimits.bytesWritten",
  ),
  "WF-TRANSACTION-DATABASE-QUERIES": guardedDefault(
    "InlineTransactionLimits.databaseQueries",
    "transactionLimits.databaseQueries",
  ),
  "WF-TRANSACTION-DOCUMENTS-READ": guardedDefault(
    "InlineTransactionLimits.documentsRead",
    "transactionLimits.documentsRead",
  ),
  "WF-TRANSACTION-DOCUMENTS-WRITTEN": guardedDefault(
    "InlineTransactionLimits.documentsWritten",
    "transactionLimits.documentsWritten",
  ),
  "WF-TRANSACTION-FUNCTIONS-SCHEDULED": guardedDefault(
    "InlineTransactionLimits.functionsScheduled",
    "transactionLimits.functionsScheduled",
  ),
  "WF-TRANSACTION-SCHEDULED-FUNCTION-ARGS-BYTES": guardedDefault(
    "InlineTransactionLimits.scheduledFunctionArgsBytes",
    "transactionLimits.scheduledFunctionArgsBytes",
  ),
  "WF-EDGE-ID": generated("WorkflowEdge.id", "edge identity"),
  "WF-EDGE-SOURCE": generated(
    "WorkflowEdge.sourceNodeId",
    "ready-node traversal",
  ),
  "WF-EDGE-TARGET": generated(
    "WorkflowEdge.targetNodeId",
    "ready-node traversal",
  ),
  "WF-STEP-EVENT": generated(
    "runRegisteredWorkflowEvent",
    "ID-bound await and persisted consumed reconciliation",
    "packages/convex/test/workflow-conformance.test.ts",
  ),
  "WF-SEND-EVENT": generated(
    "generated workflowContracts.sendEvent selector",
    "authenticated translation to component-owned EventId",
    "tooling/generators/src/customer-runtime.test.ts",
  ),
  "WF-CREATE-EVENT": guardedDefault(
    "generated internal event allocation refs",
    "internal persisted generation allocation only",
  ),
  "WF-DEFINE": generated(
    "defineMaestroWorkflow",
    "Confect-owned registered runner",
    runnerFixture,
  ),
};

export const buildWorkflowFiles = (
  options: WorkflowGeneratorOptions,
): WorkflowGeneratorResult => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const description =
    options.description ??
    `Generated ${name} workflow. Replace the source-to-receipt graph after review.`;
  const files: readonly GeneratedFile[] = [
    {
      path: `packages/convex/confect/workflowContracts/${name}.spec.ts`,
      content: `import { FunctionSpec, GroupSpec } from "@confect/core";
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
import { DurableWorkflowPrincipal } from "../workflows/_kit/principal";
import { WorkflowCurrentAuthorityReceipt } from "../workflows/_kit/principalAuthorization";
import { WorkflowStatusResult } from "../workflows/_kit/status";
import { WorkflowAdmissionDenied } from "../workflows/_kit/workflowAdmission";
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
const WorkflowStartErrors = Schema.Union([
  WorkflowErrors,
  WorkflowAdmissionDenied,
]);

const StartArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  idempotencyKey: Schema.String,
});

const StartReturns = Schema.Struct({
  status: Schema.Literal("queued"),
  workflow: Schema.Literal("${name}"),
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

export const authorizeConsequential = FunctionSpec.internalQuery({
  name: "authorizeConsequential",
  args: () =>
    Schema.Struct({
      workspaceId: Id("workspaces"),
      principal: DurableWorkflowPrincipal,
      requiredGrants: Schema.Array(Schema.NonEmptyString),
      capability: Schema.NonEmptyString,
      workflowId: Schema.NonEmptyString,
      workflowVersion: Schema.Number.pipe(
        Schema.check(Schema.isInt()),
        Schema.check(Schema.isGreaterThanOrEqualTo(1)),
      ),
    }),
  returns: () => WorkflowCurrentAuthorityReceipt,
  error: () => MemberNotInWorkspace,
});

export const startInteractive = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "startInteractive",
    args: () => StartArgs,
    returns: () => StartReturns,
    error: () => WorkflowStartErrors,
  }),
  {
    namespace: "workflows.${name}",
    name: "startInteractive",
    operationId: "workflows.${name}.startInteractive",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
      "WorkflowAdmissionDenied",
    ],
    idempotent: false,
    argsSchemaName: "workflows.${name}.startInteractive.args",
    returnsSchemaName: "workflows.${name}.startInteractive.returns",
    argsSchema: StartArgs,
    returnsSchema: StartReturns,
  },
);

export const startQueued = defineContractFunction(
  FunctionSpec.publicMutation({
    name: "startQueued",
    args: () => StartArgs,
    returns: () => StartReturns,
    error: () => WorkflowStartErrors,
  }),
  {
    namespace: "workflows.${name}",
    name: "startQueued",
    operationId: "workflows.${name}.startQueued",
    kind: "mutation",
    surfaces: ["web", "api", "cli", "mcp"],
    typedErrors: [
      "Unauthorized",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "NotFound",
      "ValidationFailed",
      "WorkflowAdmissionDenied",
    ],
    idempotent: false,
    argsSchemaName: "workflows.${name}.startQueued.args",
    returnsSchemaName: "workflows.${name}.startQueued.returns",
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
    namespace: "workflows.${name}",
    name: "status",
    operationId: "workflows.${name}.status",
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
    argsSchemaName: "workflows.${name}.status.args",
    returnsSchemaName: "workflows.${name}.status.returns",
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
    namespace: "workflows.${name}",
    name,
    operationId: "workflows.${name}." + name,
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
    argsSchemaName: "workflows.${name}." + name + ".args",
    returnsSchemaName: "workflows.${name}." + name + ".returns",
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

const ListArgs = Schema.Struct({ workspaceId: Id("workspaces"), ...Pagination });
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
    namespace: "workflows.${name}",
    name: "sendEvent",
    operationId: "workflows.${name}.sendEvent",
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
    argsSchemaName: "workflows.${name}.sendEvent.args",
    returnsSchemaName: "workflows.${name}.sendEvent.returns",
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
  .addFunction(authorizeConsequential)
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
`,
    },
    {
      path: `packages/convex/confect/workflowContracts/${name}.impl.ts`,
      content: `import type { GenericId } from "convex/values";
import {
  getMaestroWorkflowStatus as getStatus,
  type MaestroWorkflowComponent as WorkflowComponent,
  type MaestroWorkflowId as WorkflowId,
} from "../workflows/_kit/defineMaestroWorkflow";
import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import {
  componentsGeneric,
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";
import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import {
  DatabaseReader,
  MutationRunner,
  QueryRunner,
  QueryCtx,
} from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import {
  MemberNotInWorkspace,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { startWorkflowAndRecordOwnership } from "../workflows/_kit/ownership";
import { WorkflowAdmissionDenied } from "../workflows/_kit/workflowAdmission";
import {
  createWorkflowUserPrincipal,
  type DurableWorkflowPrincipal,
} from "../workflows/_kit/principal";
import {
  resolveWorkflowPolicySnapshotForRun,
  type WorkflowPolicySnapshot,
} from "../workflows/_kit/policySnapshotCurrent";
import type {
  WorkflowCompletionResult,
  WorkflowOnCompleteContext,
} from "../workflows/lifecycleReconciliation";
import {
  projectWorkflowStatus,
  type WorkflowStatusRunProjection,
} from "../workflows/_kit/status";
import { ${name}Graph } from "../workflows/${name}/v1.graph";
import { validateWorkflowEventDelivery } from "../workflows/_kit/events";
import { ${name}ApprovalDecisionEvent } from "../workflows/${name}/v1.registry";
import {
  ${name}CurrentGrantPolicy,
} from "../workflows/${name}/v1.registry";
import { requireConsequentialWorkflowAuthority } from "../workflows/_kit/principalAuthorization";
import ${name} from "./${name}.spec";

const withConfectClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  // Confect provides Clock at runtime, but its current handler type omits it.
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const workflowComponent =
  componentsGeneric().workflow as unknown as WorkflowComponent;

type WorkflowRunFunctionArgs = {
  readonly args: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly idempotencyKey: string;
    readonly principal: DurableWorkflowPrincipal;
    readonly policySnapshot: WorkflowPolicySnapshot;
  };
  readonly startAsync?: boolean;
};

const ${name}RunRef = makeFunctionReference<
  "mutation",
  WorkflowRunFunctionArgs,
  WorkflowId
>("workflowRunners/${name}/v1:run") as unknown as FunctionReference<
  "mutation",
  "internal",
  WorkflowRunFunctionArgs,
  WorkflowId
>;

type WorkflowCompletionArgs = {
  readonly workflowId: string;
  readonly context: WorkflowOnCompleteContext;
  readonly result: WorkflowCompletionResult;
};

const ${name}OnCompleteRef = makeFunctionReference<
  "mutation",
  WorkflowCompletionArgs,
  null
>("workflowRunners/${name}/v1:onComplete") as unknown as FunctionReference<
  "mutation",
  "internal",
  WorkflowCompletionArgs,
  null
>;

const toWorkflowPolicyValidationFailed = (): ValidationFailed =>
  new ValidationFailed({
    field: "workflowPolicy",
    message: "Workflow policy could not be resolved.",
  });

type WorkflowError =
  | Unauthorized
  | MemberNotInWorkspace
  | WorkspaceNotFound
  | NotFound
  | ValidationFailed;
type WorkflowStartError = WorkflowError | WorkflowAdmissionDenied;

const isWorkflowError = (error: unknown): error is WorkflowError =>
    error instanceof Unauthorized ||
    error instanceof MemberNotInWorkspace ||
    error instanceof WorkspaceNotFound ||
    error instanceof NotFound ||
    error instanceof ValidationFailed;
const toWorkflowValidationFailed = (): ValidationFailed =>
  new ValidationFailed({
    field: "workflow",
    message: "Workflow operation failed.",
  });
const toWorkflowError = (error: unknown): WorkflowError =>
  isWorkflowError(error) ? error : toWorkflowValidationFailed();
const preserveWorkflowStartErrors = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, WorkflowStartError, R> =>
  effect.pipe(
    Effect.catch((error) =>
      isWorkflowError(error) || error instanceof WorkflowAdmissionDenied
        ? Effect.fail(error)
        : Effect.die(error),
    ),
  );

const findWorkflowRun = (
  workspaceId: GenericId<"workspaces">,
  componentWorkflowId: string,
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const run = yield* reader
      .table("workflowRuns")
      .index("by_workspace_component_workflow", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("componentWorkflowId", componentWorkflowId),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);

    if (!run) {
      return yield* Effect.fail(
        new NotFound({
          resource: "workflowRuns",
          id: componentWorkflowId,
        }),
      );
    }

    return run;
  });

const startWithProfile = (
  kickoffProfile: "interactive" | "queued",
  { workspaceId, idempotencyKey }: {
    readonly workspaceId: GenericId<"workspaces">;
    readonly idempotencyKey: string;
  },
) =>
  Effect.gen(function* () {
      const access = yield* withConfectClock(
        requireWorkspaceAccess(workspaceId, "editor"),
      );
      const startedAt = yield* withConfectClock(Clock.currentTimeMillis);
      const principal = createWorkflowUserPrincipal({
        workspaceId,
        actorId: access.userId,
        role: access.role,
        grants: ["workflow:start"],
        authEpoch: access.authEpoch,
        kickoffAt: startedAt,
      });
      const policySnapshot = yield* resolveWorkflowPolicySnapshotForRun(
        ${name}Graph.policyPosture,
        { workspaceId, resolvedAt: startedAt },
      ).pipe(Effect.mapError(toWorkflowPolicyValidationFailed));
      const componentWorkflowId = yield* startWorkflowAndRecordOwnership({
        workflowRef: ${name}RunRef,
        onCompleteRef: ${name}OnCompleteRef,
        buildWorkflowArgs: (workflowRunId) => ({
          workspaceId,
          workflowRunId,
          idempotencyKey,
          principal,
          policySnapshot,
        }),
        workspaceId,
        workflowId: ${name}Graph.id,
        workflowVersion: ${name}Graph.version,
        graphJson: JSON.stringify(${name}Graph),
        idempotencyKey,
        startedByUserId: access.userId,
        startedAt: startedAt,
        principalSnapshot: principal,
        policySnapshot,
        workflowKind: "workflow.${name}",
        kickoffProfile:
          kickoffProfile === "interactive" ? "eager-first-poll" : "queued",
      });
      const run = yield* findWorkflowRun(workspaceId, componentWorkflowId);

      return {
        status: "queued" as const,
        workflow: "${name}" as const,
        workflowRunId: run._id,
        componentWorkflowId,
      };
  }).pipe(preserveWorkflowStartErrors);

const startInteractiveImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "startInteractive",
  (args) => startWithProfile("interactive", args),
);

const authorizeConsequentialImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "authorizeConsequential",
  (args) =>
    Effect.gen(function* () {
      if (args.principal.workspaceId !== args.workspaceId) {
        return yield* new MemberNotInWorkspace({
          membershipId: "workflow-actor",
        });
      }
      const access = yield* withConfectClock(
        requireConsequentialWorkflowAuthority(
          args.principal,
          args.requiredGrants,
          ${name}CurrentGrantPolicy,
        ),
      );
      return {
        kind: "workflow-current-authority" as const,
        version: 1 as const,
        workspaceId: access.workspaceId,
        actorId: access.userId,
        authEpoch: access.authEpoch,
        capability: args.capability,
        workflowId: args.workflowId,
        workflowVersion: args.workflowVersion,
        requiredGrants: args.requiredGrants,
      };
    }),
);

const startQueuedImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "startQueued",
  (args) => startWithProfile("queued", args),
);

const statusImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "status",
  ({ workspaceId, componentWorkflowId }) =>
    Effect.gen(function* () {
      yield* withConfectClock(requireWorkspaceAccess(workspaceId, "viewer"));
      const run = yield* findWorkflowRun(workspaceId, componentWorkflowId);
      const ctx = yield* QueryCtx;
      const rawStatus = yield* Effect.promise(() =>
        getStatus(ctx, workflowComponent, componentWorkflowId as WorkflowId),
      ).pipe(Effect.mapError(toWorkflowValidationFailed));
      const runProjection = {
        ...(run.status !== undefined ? { status: run.status } : {}),
        ...(run.deadlineAt !== undefined ? { deadlineAt: run.deadlineAt } : {}),
        ...(run.timedOutAt !== undefined ? { timedOutAt: run.timedOutAt } : {}),
        ...(run.timeoutErrorCode !== undefined
          ? { timeoutErrorCode: run.timeoutErrorCode }
          : {}),
        ...(run.timeoutSummary !== undefined
          ? { timeoutSummary: run.timeoutSummary }
          : {}),
        ...(run.lifecycleExecution !== undefined
          ? { lifecycleExecution: run.lifecycleExecution }
          : {}),
        ...(run.lifecycleGeneration !== undefined
          ? { lifecycleGeneration: run.lifecycleGeneration }
          : {}),
        ...(run.priorGenerationQuiescence !== undefined
          ? { priorGenerationQuiescence: run.priorGenerationQuiescence }
          : {}),
        ...(run.cleanupState !== undefined
          ? { cleanupState: run.cleanupState }
          : {}),
        ...(run.componentCleanupState !== undefined
          ? { componentCleanupState: run.componentCleanupState }
          : {}),
        ...(run.componentResidualState !== undefined
          ? { componentResidualState: run.componentResidualState }
          : {}),
      } satisfies WorkflowStatusRunProjection;

      return projectWorkflowStatus(rawStatus, runProjection);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const sendEventImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "sendEvent",
  ({ selector, delivery }) =>
    Effect.gen(function* () {
      const validated = validateWorkflowEventDelivery(
        ${name}ApprovalDecisionEvent,
        delivery,
      );
      const occurredAt = yield* withConfectClock(Clock.currentTimeMillis);
      const runMutation = yield* MutationRunner;
      return yield* runMutation(refs.internal.workflows.eventInstances.send, {
        selector:
          selector.kind === "id"
            ? selector
            : {
                kind: "definition" as const,
                componentWorkflowId: selector.componentWorkflowId,
                eventDefinition: ${name}ApprovalDecisionEvent.reference,
                eventInstanceKey: selector.eventInstanceKey,
              },
        delivery: validated,
        occurredAt,
      });
    }).pipe(Effect.mapError(toWorkflowError)),
);

const cancelImpl = FunctionImpl.make(databaseSchema, ${name}, "cancel", (args) =>
  Effect.gen(function* () {
    const runMutation = yield* MutationRunner;
    return yield* runMutation(refs.internal.workflows.lifecycle.cancel, args);
  }).pipe(Effect.mapError(toWorkflowError)),
);

const restartImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "restart",
  (args) =>
    Effect.gen(function* () {
      const runMutation = yield* MutationRunner;
      return yield* runMutation(refs.internal.workflows.lifecycle.restart, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const listImpl = FunctionImpl.make(databaseSchema, ${name}, "list", (args) =>
  Effect.gen(function* () {
    const runQuery = yield* QueryRunner;
    return yield* runQuery(refs.internal.workflows.lifecycle.list, args);
  }).pipe(Effect.mapError(toWorkflowError)),
);

const listByNameImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "listByName",
  (args) =>
    Effect.gen(function* () {
      const runQuery = yield* QueryRunner;
      return yield* runQuery(refs.internal.workflows.lifecycle.listByName, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const listStepsImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "listSteps",
  (args) =>
    Effect.gen(function* () {
      const runQuery = yield* QueryRunner;
      return yield* runQuery(refs.internal.workflows.lifecycle.listSteps, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

const cleanupImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "cleanup",
  (args) =>
    Effect.gen(function* () {
      const runMutation = yield* MutationRunner;
      return yield* runMutation(refs.internal.workflows.lifecycle.cleanup, args);
    }).pipe(Effect.mapError(toWorkflowError)),
);

export default GroupImpl.make(databaseSchema, ${name}).pipe(
  Layer.provide(authorizeConsequentialImpl),
  Layer.provide(startInteractiveImpl),
  Layer.provide(startQueuedImpl),
  Layer.provide(statusImpl),
  Layer.provide(cancelImpl),
  Layer.provide(restartImpl),
  Layer.provide(listImpl),
  Layer.provide(listByNameImpl),
  Layer.provide(listStepsImpl),
  Layer.provide(cleanupImpl),
  Layer.provide(sendEventImpl),
  GroupImpl.finalize,
);
`,
    },
    {
      path: `packages/convex/confect/workflows/${name}/v1.graph.ts`,
      content: `import * as Result from "effect/Result";
import { defineWorkflowGraphV2 } from "../_kit/workflowBuilderCurrent";
import { defineWorkflowReferenceRegistry } from "../_kit/workflowReferences";

export const ${name}References = defineWorkflowReferenceRegistry({
  capabilities: { eventControl: "capability.workflowEventControl.v1" },
  workflows: { self: "workflow.${name}.v2" },
  events: { approvalDecision: "event.approvalDecision.v1" },
});

export const ${name}Graph = Result.getOrThrow(defineWorkflowGraphV2({
  id: "workflow_${name}",
  version: 2,
  startNodeId: "start",
  argsSchemaName: "${name}.v2.args",
  returnSchemaName: "${name}.v2.return",
  principalSchemaName: "workflowPrincipal.v2",
  policyPosture: {
    kind: "none",
    reason: "Generated source-to-receipt workflow has no policy decisions.",
  },
  kickoffProfiles: [
    { name: "interactive", mode: "eager-first-poll", default: true },
    { name: "queued", mode: "queued", default: false },
  ],
  nodes: [
    {
      id: "start",
      kind: "source",
      label: "${name} start",
      stepName: "start.v2",
      payloadPolicy: {
        maxInputBytes: 64000,
        maxResultBytes: 64000,
        resultMode: "inline",
      },
      semanticRuleIds: ["WF-NODE-KIND"],
    },
    {
      id: "receipt",
      kind: "output",
      label: "Trust Receipt",
      stepName: "receipt.v2",
      payloadPolicy: {
        maxInputBytes: 64000,
        maxResultBytes: 64000,
        resultMode: "inline",
      },
      semanticRuleIds: ["WF-NODE-KIND"],
    },
  ],
  edges: [
    {
      id: "edge_start_receipt",
      sourceNodeId: "start",
      targetNodeId: "receipt",
    },
  ],
  joins: [],
}));
`,
    },
    {
      path: `packages/convex/confect/workflows/${name}/v1.registry.ts`,
      content: `import refs from "../../_generated/refs";
import * as Ref from "@confect/core/Ref";
import { components } from "../../../convex/_generated/api";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import * as Schema from "effect/Schema";
import {
  buildWorkflowCapabilityArgs,
  defineWorkflowCapabilityRegistry,
} from "../_kit/graphRunnerV2Current";
import { runWorkflowCapabilityBoundary } from "../_kit/workflowCapabilityBoundary";
import {
  defineWorkflowRoleGrantPolicy,
  requireConsequentialWorkflowAuthority,
} from "../_kit/principalAuthorization";
import {
  defineWorkflowEvent,
  defineWorkflowV2EventRegistry,
} from "../_kit/events";
import { defineEmptyWorkflowV2SubworkflowRegistry } from "../_kit/subworkflowsCurrent";
import { generatedWorkflowSubworkflowPolicy } from "../_kit/workpoolConfig";
import { ${name}References } from "./v1.graph";

/**
 * Generated typed capability registry. Add entries only through generated
 * internal refs. External actions must declare effect strategy, effect class,
 * logical instance-key mapping, dedupe/restart horizons, guard postures,
 * redaction policy, and provider/reconciliation fixture evidence.
 * Query and mutation nodes use an independent Workpool transaction by default.
 * Inline nodes must be authored with a named generated preset.
 * External actions declare only consequential metadata. The generated runner,
 * not an entry or caller, owns the fixed current-authority query ref that reloads
 * membership and applies this workflow's role-to-grants policy before admission.
 */
export const ${name}CapabilityRegistry = defineWorkflowCapabilityRegistry({});

/** Every generated buildArgs mapper delegates here to append pinned authority. */
export const ${name}CapabilityArgs = buildWorkflowCapabilityArgs;

/** Generated capabilities must cross this boundary before Workpool returns. */
export const ${name}CapabilityBoundary = runWorkflowCapabilityBoundary;
export const ${name}ConsequentialAuthority =
  requireConsequentialWorkflowAuthority;

export const ${name}CurrentGrantPolicy = defineWorkflowRoleGrantPolicy({
  viewer: [],
  editor: ["workflow:start"],
  admin: ["workflow:start"],
  owner: ["workflow:start"],
});

export const ${name}ArtifactRefs = {
  put: Ref.getFunctionReference(refs.internal.workflows.artifacts.put),
  getOwned: Ref.getFunctionReference(refs.internal.workflows.artifacts.getOwned),
} as const;

export const ${name}SubworkflowLinkRefs = {
  reserveRef: refs.internal.workflows.subworkflowLinks.reserve,
  recoverReservationRef: makeFunctionReference<"query">(
    "workflows/subworkflowLinksCurrent:recoverReservation",
  ),
  persistUnresolvedReservationRef: makeFunctionReference<"mutation">(
    "workflows/subworkflowLinksCurrent:persistUnresolvedReservation",
  ),
  persistUnresolvedSuccessRef: makeFunctionReference<"mutation">(
    "workflows/subworkflowLinksCurrent:persistUnresolvedSuccess",
  ),
  recoverUnresolvedSuccessRef: makeFunctionReference<"query">(
    "workflows/subworkflowLinksCurrent:recoverUnresolvedSuccess",
  ),
  resolveUnresolvedSuccessRef: makeFunctionReference<"mutation">(
    "workflows/subworkflowLinksCurrent:resolveUnresolvedSuccess",
  ),
  reconcileRef: refs.internal.workflows.subworkflowLinks.reconcile,
  reportReconciliationFailureRef: makeFunctionReference<"mutation">(
    "workflows/subworkflowLinksCurrent:reportReconciliationFailure",
  ),
} as const;

export const ${name}EventInstanceRefs = {
  loadGeneration: components.workflow.journal.load,
  createComponentEvent: components.workflow.event.create,
  allocate: Ref.getFunctionReference(
    refs.internal.workflows.eventInstances.allocate,
  ),
  reconcile: Ref.getFunctionReference(
    refs.internal.workflows.eventInstances.reconcile,
  ),
} as const;

export const ${name}ApprovalDecisionEvent = defineWorkflowEvent({
  reference: ${name}References.events.approvalDecision,
  name: "${kebabCase(name)}-approval-decision.v1",
  schemaName: "workflows.${name}.approvalDecision.v1",
  schema: Schema.Struct({ approved: Schema.Boolean }),
  validator: v.object({ approved: v.boolean() }),
});

/** Generated typed event entries bind component and persisted internal refs. */
export const ${name}EventRegistry = defineWorkflowV2EventRegistry({
  [${name}ApprovalDecisionEvent.reference]: {
    definition: ${name}ApprovalDecisionEvent,
    creatorCapability: ${name}References.capabilities.eventControl,
    refs: ${name}EventInstanceRefs,
  },
});

/**
 * Generated immutable child registry. Every entry binds its exact version,
 * graph snapshot, stable generated runner reference, mapper/result export
 * descriptors, typed Args/Result mapping, transitive children, principal
 * narrowing, and the shared typed workflowRunLinks reserve/reconcile refs.
 * Cascade cancellation and cleanup remain restricted lifecycle operations.
 * Bounded batch entries additionally provide generated selectItems and
 * mapBatchArgs functions; maxItems, batchSize, and fanOut stay in the graph.
 */
export const ${name}SubworkflowRegistry =
  defineEmptyWorkflowV2SubworkflowRegistry();

export const ${name}SubworkflowPolicy = generatedWorkflowSubworkflowPolicy;
`,
    },
    {
      path: `packages/convex/confect/workflows/${name}.predeploy.ts`,
      content: renderGeneratedWorkflowPredeploySource(pascalName),
    },
    {
      path: `packages/convex/confect/workflowRunners/${name}/v1.ts`,
      content: `import { Ref } from "@confect/core";
import {
  defineMaestroWorkflow,
  MaestroWorkflowIdValidator,
  MaestroWorkflowResultValidator,
} from "../../workflows/_kit/defineMaestroWorkflow";
import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";
import refs from "../../_generated/refs";
import { components } from "../../../convex/_generated/api";
import {
  adaptPinnedWorkflowStep,
  runDurableGraphWorkflowV2,
} from "../../workflows/_kit/graphRunnerCurrent";
import { defineGeneratedCurrentAuthorityBinding } from "../../workflows/_kit/graphRunnerV2Current";
import {
  bindObservedWorkflowAuthority,
  loadObservedWorkflowExecutionIdentity,
} from "../../workflows/_kit/observedStageCurrent";
import { reconcileObservedWorkflowCompletion } from "../../workflows/_kit/lifecycleCompletion";
import { WorkflowOnCompleteContextValidator } from "../../workflows/_kit/lifecycleState";
import { DurableWorkflowPrincipalValidator } from "../../workflows/_kit/principal";
import { WorkflowPolicySnapshotValidator } from "../../workflows/_kit/policySnapshot";
import { SubworkflowExecutionContextValidator } from "../../workflows/_kit/subworkflowsCurrent";
import { ${name}Graph } from "../../workflows/${name}/v1.graph";
import {
  ${name}EventRegistry,
  ${name}SubworkflowPolicy,
  ${name}SubworkflowRegistry,
} from "../../workflows/${name}/v1.registry";

const executionIdentityRef = Ref.getFunctionReference(
  refs.internal.workflows.stageObservations.executionIdentity,
);
const recordStageFinished = Ref.getFunctionReference(
  refs.internal.workflows.stageObservations.recordFinished,
);
const recordStageStarted = Ref.getFunctionReference(
  refs.internal.workflows.stageObservations.recordStarted,
);
const reconcileCompletionRef = Ref.getFunctionReference(
  refs.internal.workflows.lifecycle.reconcileCompletion,
);
const activateSubworkflowRef = Ref.getFunctionReference(
  refs.internal.workflows.subworkflowLinks.activate,
);
const currentAuthority = defineGeneratedCurrentAuthorityBinding(
  ${name}Graph,
  refs.internal.workflowContracts,
);
if (
  currentAuthority.ref !==
  Ref.getFunctionReference(
    refs.internal.workflowContracts.${name}.authorizeConsequential,
  )
) {
  throw new Error("Generated workflow current authority binding is invalid.");
}

const WorkflowReceiptValidator = v.object({
  workflowId: v.string(),
  status: v.literal("completed"),
});

type WorkflowReceipt = {
  readonly workflowId: string;
  readonly status: "completed";
};

export const onComplete = internalMutationGeneric({
  args: {
    workflowId: MaestroWorkflowIdValidator,
    context: WorkflowOnCompleteContextValidator,
    result: MaestroWorkflowResultValidator,
  },
  returns: v.null(),
  handler: async (context, input): Promise<null> => {
    await reconcileObservedWorkflowCompletion(
      context,
      reconcileCompletionRef,
      input,
    );
    return null;
  },
});

const metadata = {
  workflowId: ${name}Graph.id,
  workflowVersion: ${name}Graph.version,
  runtimeVersion: "maestro-graph-v2",
  argsSchemaName: ${name}Graph.argsSchemaName,
  returnSchemaName: ${name}Graph.returnSchemaName,
  principalSchemaName: ${name}Graph.principalSchemaName,
  policyPosture: ${name}Graph.policyPosture,
  kickoffProfiles: ${name}Graph.kickoffProfiles,
  semanticRuleIds: ["WF-DEFINE", "WF-START-EAGER", "WF-START-QUEUED"],
  semanticCoverage: {
    "WF-DEFINE": {
      posture: "generated",
      constructor: "defineMaestroWorkflow",
      compiler: "WorkflowManager.define",
      fixture: "${name}.workflow.test.ts",
    },
    "WF-START-EAGER": {
      posture: "generated",
      constructor: "startInteractive",
      compiler: "startAsync false",
      fixture: "${name}.workflow.test.ts",
    },
    "WF-START-QUEUED": {
      posture: "generated",
      constructor: "startQueued",
      compiler: "startAsync true",
      fixture: "${name}.workflow.test.ts",
    },
  },
} as const;

export const run = defineMaestroWorkflow(components.workflow, {
  args: {
    workspaceId: v.string(),
    workflowRunId: v.string(),
    idempotencyKey: v.string(),
    principal: DurableWorkflowPrincipalValidator,
    policySnapshot: WorkflowPolicySnapshotValidator,
    subworkflow: v.optional(SubworkflowExecutionContextValidator),
  },
  returns: WorkflowReceiptValidator,
}, metadata).handler(async (step, args): Promise<WorkflowReceipt> => {
  const executionIdentity = await loadObservedWorkflowExecutionIdentity(
    step,
    executionIdentityRef,
    {
    workspaceId: args.workspaceId,
    workflowRunId: args.workflowRunId,
    ...(args.subworkflow
      ? { subworkflow: args.subworkflow, activateSubworkflowRef }
      : {}),
    },
  );
  const executionArgs = bindObservedWorkflowAuthority(args, executionIdentity);
  return runDurableGraphWorkflowV2(adaptPinnedWorkflowStep(step), {
    graph: ${name}Graph,
    inputs: executionArgs,
    principal: executionArgs.principal,
    policySnapshot: executionArgs.policySnapshot,
    currentAuthority,
    effectIdentity: {
      workspaceId: args.workspaceId,
      workflowRunId: args.workflowRunId,
      generation: executionIdentity.generation,
      occurredAt: executionIdentity.observedAt,
    },
    observability: { recordStageStarted, recordStageFinished },
    workflowRegistry: ${name}SubworkflowRegistry,
    eventRegistry: ${name}EventRegistry,
    subworkflowPolicy: ${name}SubworkflowPolicy,
    projectOutput: () => ({ workflowId: ${name}Graph.id, status: "completed" as const }),
  });
});
`,
    },
    {
      path: `packages/convex/confect/workflowRunners/${name}/v1.spec.ts`,
      content: `import { FunctionSpec, GroupSpec } from "@confect/core";
import type { onComplete, run } from "./v1";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexInternalMutation<typeof run>()("run"))
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof onComplete>()("onComplete"),
  );
`,
    },
    {
      path: `packages/convex/confect/workflowRunners/${name}/v1.impl.ts`,
      content: `import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "../../_generated/schema";
import { onComplete, run } from "./v1";
import ${name} from "./v1.spec";

const runImpl = FunctionImpl.make(databaseSchema, ${name}, "run", run);
const onCompleteImpl = FunctionImpl.make(
  databaseSchema,
  ${name},
  "onComplete",
  onComplete,
);

export default GroupImpl.make(databaseSchema, ${name}).pipe(
  Layer.provide(runImpl),
  Layer.provide(onCompleteImpl),
  GroupImpl.finalize,
);
`,
    },
    {
      path: `packages/convex/test/${name}.workflow.test.ts`,
      content: `import { describe, expect, it } from "vitest";
import { ${name}Graph } from "../confect/workflows/${name}/v1.graph";
import {
  runDurableGraphWorkflowV2,
  type RunDurableGraphStep,
} from "../confect/workflows/_kit/graphRunnerCurrent";

describe("${name} durable workflow scaffold", () => {
  it("runs the generated source-to-output graph", async () => {
    const step: RunDurableGraphStep = {
      runQuery: async () => {
        throw new Error("Generated source/output graph should not run queries.");
      },
      runMutation: async () => {
        throw new Error("Generated source/output graph should not run mutations.");
      },
      runAction: async () => {
        throw new Error("Generated source/output graph should not run actions.");
      },
      sleep: async () => {},
      awaitEvent: async () => {
        throw new Error("Generated source/output graph should not await events.");
      },
    };

    const inputs = {
      workspaceId: "workspace_123",
      idempotencyKey: "workflow-test-1",
    };

    const result = await runDurableGraphWorkflowV2(step, {
      graph: ${name}Graph,
      inputs,
      principal: {
        version: 2,
        kind: "system",
        workspaceId: inputs.workspaceId,
        systemId: "workflow-test",
        reason: "fixture",
        grants: [],
        kickoffAt: 1,
        provenance: "scheduled-system-workflow",
      },
      policySnapshot: { version: 1, kind: "none", reason: "fixture" },
      projectOutput: () => ({
        workflowId: ${name}Graph.id,
        status: "completed" as const,
      }),
    });

    expect(result).toEqual({
      workflowId: ${name}Graph.id,
      status: "completed",
    });
  });
});
`,
    },
    {
      path: `docs/template/generated/workflows/${name}.semantics.json`,
      content: `${JSON.stringify(workflowGeneratorSemanticCoverage, null, 2)}\n`,
    },
    {
      path: `docs/template/generated/workflows/${name}.md`,
      content: `# ${pascalName} Workflow

${description}

Canonical system: \`${options.system}\` (\`${options.disposition}\`).

## Generated Files

- \`packages/convex/confect/workflowRunners/${name}/v1.ts\`: immutable-version Confect-owned runner source.
- \`packages/convex/convex/workflowRunners/${name}/v1.ts\`: reproducible versioned Confect projection; never edit it by hand.
- \`docs/template/generated/workflows/${name}.semantics.json\`: semantic coverage keyed by executable rule id.
- \`packages/convex/confect/workflowContracts/${name}.spec.ts\`: typed start, status, event, cancel, restart, list, step-list, and cleanup contract.
- \`packages/convex/confect/workflowContracts/${name}.impl.ts\`: Confect implementation that records workflow ownership and projects component status.
- \`packages/convex/confect/workflows/${name}/v1.graph.ts\`: versioned durable graph data, initially source to Trust Receipt output only.
- \`packages/convex/confect/workflows/${name}/v1.registry.ts\`: exact versioned capability, event, child-workflow, and internal-ref bindings.
- \`packages/convex/confect/workflows/${name}.predeploy.ts\`: collected workflow-component Workpool declarations and the injected canonical predeploy findings gate.
- \`packages/convex/test/${name}.workflow.test.ts\`: focused runner scaffold for the default graph.

## Required Follow-Up

1. Keep the generated \`startInteractive\` and \`startQueued\` mutations as the only kickoff-mode selectors; callers never supply the mode or principal.
2. Run \`pnpm confect:codegen\`, then \`pnpm --dir packages/convex exec convex codegen\`, so Confect reproduces \`workflowRunners/${name}/v1:run\` before typecheck.
3. Preserve the authenticated handler's server-derived principal projection when specializing start behavior.
4. Keep React Flow as a projection of \`${name}/v1.graph.ts\`; do not persist canvas node state as the workflow contract.
5. Generated event nodes require \`workflowContracts.${name}.sendEvent\`; callers select an owned opaque ID or generated definition key and never provide workspace, principal, or raw component names.
6. Generated capability nodes require registry entries with generated internal refs, concrete \`buildArgs\` and logical instance-key mappers, and complete effect/guard/redaction/evidence contracts.
7. Generated subworkflow entries require one immutable publication binding for the child graph snapshot, stable generated runner-reference identity, stable mapper/result export descriptors, lifecycle contract, typed Args/Result schemas, declared transitive children, principal posture, and \`${name}SubworkflowLinkRefs\`; cycle, depth, and fan-out checks run before child dispatch.
8. The child registry exposes reserve, reconcile, and reconciliation-failure reporting only. Cascade cancellation and cleanup remain restricted until product lifecycle controls drive them end to end. Workflow 0.4.4 scheduled children remain rejected; use a named sleep plus an unscheduled child only as a deliberately non-equivalent alternative.
9. Query and mutation capabilities use independent Workpool transactions by default. Inline is restricted to declared small atomic work: novice authors choose \`tiny\` or \`small-atomic\`; raw counters require the reviewed advanced constructor. Actions and scheduled steps cannot be inline.
10. Cancel is cooperative: an already-running action may finish, and compensation is a separate explicit workflow. Restart refuses unstable anchors, active Workpool/exposed work, and downstream external actions without generation-scoped dedupe evidence.
11. Cleanup is retention-gated and never claims full component deletion. Schedule bounded calls to \`workflows.lifecycle.sweepRetention\`; pinned Workflow 0.4.4 may leave never-awaited events or failed completion records as explicitly unverifiable residuals.
12. Run \`pnpm check:workflow:fast\`, \`pnpm check:confect-contracts\`, and focused workflow tests.
`,
    },
  ];

  return {
    name,
    pascalName,
    system: options.system,
    disposition: options.disposition,
    files: withGeneratorProvenance("add-workflow", name, files, {
      system: options.system,
      disposition: options.disposition,
    }),
  };
};
