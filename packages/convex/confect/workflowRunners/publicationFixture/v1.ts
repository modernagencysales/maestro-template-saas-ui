import { Ref } from "@confect/core";
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
  runDurableGraphWorkflowV2,
  type RunDurableGraphStep,
} from "../../workflows/_kit/graphRunner";
import { loadObservedWorkflowExecutionIdentity } from "../../workflows/_kit/observedStage";
import { reconcileObservedWorkflowCompletion } from "../../workflows/_kit/lifecycleCompletion";
import { WorkflowOnCompleteContextValidator } from "../../workflows/_kit/lifecycleState";
import { publicationFixtureGraph } from "../../workflows/publicationFixture/v1.graph";
import {
  publicationFixtureEventRegistry,
  publicationFixtureSubworkflowPolicy,
  publicationFixtureSubworkflowRegistry,
} from "../../workflows/publicationFixture/v1.registry";

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

const WorkflowPrincipalValidator = v.union(
  v.object({
    version: v.literal(1),
    kind: v.literal("user"),
    workspaceId: v.string(),
    actorId: v.string(),
    role: v.string(),
    grants: v.array(v.string()),
    authEpoch: v.number(),
    kickoffAt: v.number(),
    provenance: v.string(),
  }),
  v.object({
    version: v.literal(1),
    kind: v.literal("system"),
    workspaceId: v.string(),
    systemId: v.string(),
    reason: v.string(),
    grants: v.array(v.string()),
    kickoffAt: v.number(),
  }),
);

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
  workflowId: publicationFixtureGraph.id,
  workflowVersion: 1,
  runtimeVersion: "maestro-graph-v2",
  argsSchemaName: publicationFixtureGraph.argsSchemaName,
  returnSchemaName: publicationFixtureGraph.returnSchemaName,
  principalSchemaName: publicationFixtureGraph.principalSchemaName,
  policyPosture: publicationFixtureGraph.policyPosture,
  kickoffProfiles: publicationFixtureGraph.kickoffProfiles,
  semanticRuleIds: ["WF-DEFINE", "WF-START-EAGER", "WF-START-QUEUED"],
  semanticCoverage: {
    "WF-DEFINE": {
      posture: "generated",
      constructor: "defineMaestroWorkflow",
      compiler: "WorkflowManager.define",
      fixture: "publicationFixture.workflow.test.ts",
    },
    "WF-START-EAGER": {
      posture: "generated",
      constructor: "startInteractive",
      compiler: "startAsync false",
      fixture: "publicationFixture.workflow.test.ts",
    },
    "WF-START-QUEUED": {
      posture: "generated",
      constructor: "startQueued",
      compiler: "startAsync true",
      fixture: "publicationFixture.workflow.test.ts",
    },
  },
} as const;

export const run = defineMaestroWorkflow(
  components.workflow,
  {
    args: {
      workspaceId: v.string(),
      workflowRunId: v.string(),
      idempotencyKey: v.string(),
      principal: WorkflowPrincipalValidator,
    },
    returns: WorkflowReceiptValidator,
  },
  metadata,
).handler(async (step, args): Promise<WorkflowReceipt> => {
  const executionIdentity = await loadObservedWorkflowExecutionIdentity(
    step,
    executionIdentityRef,
    {
      workspaceId: args.workspaceId,
      workflowRunId: args.workflowRunId,
    },
  );
  return runDurableGraphWorkflowV2(step as RunDurableGraphStep, {
    graph: publicationFixtureGraph,
    inputs: args,
    principal: args.principal,
    policySnapshot: {
      kind: "none",
      reason:
        publicationFixtureGraph.policyPosture.kind === "none"
          ? publicationFixtureGraph.policyPosture.reason
          : "generated",
    },
    effectIdentity: {
      workspaceId: args.workspaceId,
      workflowRunId: args.workflowRunId,
      generation: executionIdentity.generation,
      occurredAt: executionIdentity.observedAt,
    },
    observability: { recordStageStarted, recordStageFinished },
    workflowRegistry: publicationFixtureSubworkflowRegistry,
    eventRegistry: publicationFixtureEventRegistry,
    subworkflowPolicy: publicationFixtureSubworkflowPolicy,
    projectOutput: () => ({
      workflowId: publicationFixtureGraph.id,
      status: "completed" as const,
    }),
  });
});
