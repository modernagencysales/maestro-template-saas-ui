import * as Schema from "effect/Schema";
import { Ref } from "@confect/core";
import { describe, expect, it, vi } from "vitest";

import {
  WorkflowCapabilityReference,
  type DurableWorkflowGraphV2,
} from "../confect/workflows/graph";
import {
  runDurableGraphWorkflowV2,
  type RunDurableGraphStep,
} from "../confect/workflows/_kit/graphRunner";
import type { WorkflowEffectContract } from "../confect/workflows/_kit/effectReservations";
import { defineGeneratedCurrentAuthorityBinding } from "../confect/workflows/_kit/graphRunnerV2";
import refs from "../confect/_generated/refs";

const capability = Schema.decodeSync(WorkflowCapabilityReference)(
  "capability.fixtureStage.v1",
);
const queryRef = Ref.getFunctionReference(
  refs.internal.workflows.stageObservations.executionIdentity,
);
const stageFinished = Ref.getFunctionReference(
  refs.internal.workflows.stageObservations.recordFinished,
);
const mutationRef = Ref.getFunctionReference(
  refs.internal.workflows.stageObservations.recordStarted,
);
const stageStarted = mutationRef;
const actionRef = Ref.getFunctionReference(
  refs.internal.jobs.workpool.backgroundWork,
);
const externalAuthorization = {
  kind: "consequential",
  requiredGrants: ["fixture:dispatch"],
  boundary: "generated-current-authority",
} as const;

const generatedCurrentAuthority = defineGeneratedCurrentAuthorityBinding(
  { id: "observed-stage-v2", version: 2 },
  {
    observedStageV2: {
      authorizeConsequential: {
        functionNamespace: "workflowContracts/observedStageV2",
        functionSpec: { name: "authorizeConsequential" },
      },
    },
  },
);

const currentAuthorityReceipt = {
  kind: "workflow-current-authority",
  version: 1,
  workspaceId: "workspace-1",
  actorId: "user-1",
  authEpoch: 2,
  capability,
  workflowId: "observed-stage-v2",
  workflowVersion: 2,
  requiredGrants: ["fixture:dispatch"],
} as const;

describe("workflow lifecycle observed-stage generation evidence", () => {
  it.each(["query", "mutation"] as const)(
    "classifies %s stages as non-external",
    async (kind) => {
      const observed = await run(kind);
      expect(observed).toContainEqual(
        expect.objectContaining({
          nodeId: "work",
          lifecycleGeneration: 4,
          externalEffect: false,
        }),
      );
    },
  );

  it("classifies an external action before dispatch", async () => {
    const observed = await run("action");
    expect(observed).toContainEqual(
      expect.objectContaining({
        nodeId: "work",
        stageKey: "work.v2",
        lifecycleGeneration: 4,
        externalEffect: true,
      }),
    );
  });

  it("persists canonical graph order across multiple ready waves", async () => {
    const observed = await run("query");
    expect(
      observed
        .filter(({ status }) => status === "running")
        .map(({ nodeId, order }) => [nodeId, order]),
    ).toEqual([
      ["source", 0],
      ["work", 1],
      ["output", 2],
    ]);
  });

  it("persists bounded receipts instead of workflow values", async () => {
    const observed = await run("query");
    const finished = observed.find(
      (entry) => entry.nodeId === "work" && entry.status === "succeeded",
    );
    expect(finished?.outputJson).toEqual(expect.any(String));
    expect(JSON.parse(String(finished?.outputJson))).toMatchObject({
      kind: "bounded-inline",
      measuredBytes: expect.any(Number),
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(finished?.outputJson).not.toContain('"ok":true');
  });
});

const run = async (kind: "query" | "mutation" | "action") => {
  const observed: Record<string, unknown>[] = [];
  const runMutation = vi.fn(async (ref, args) => {
    if (ref === stageStarted || ref === stageFinished) observed.push(args);
    return null;
  });
  const step: RunDurableGraphStep = {
    runQuery: async (ref) =>
      ref === generatedCurrentAuthority.ref
        ? currentAuthorityReceipt
        : { ok: true },
    runMutation,
    runAction: async () => ({ ok: true }),
    sleep: async () => undefined,
    awaitEvent: async () => {
      throw new Error("Fixture does not await events.");
    },
  };
  const common = {
    graph: graph(kind),
    inputs: {},
    principal: {
      version: 2,
      kind: "user",
      workspaceId: "workspace-1",
      grants: ["fixture:dispatch"],
      kickoffAt: 1,
      actorId: "user-1",
      role: "editor",
      authEpoch: 1,
      provenance: "authenticated-workflow-start",
    } as const,
    policySnapshot: { kind: "none" },
    effectIdentity: {
      workspaceId: "workspace-1",
      workflowRunId: "run-1",
      generation: 4,
      occurredAt: 10,
    },
    observability: {
      recordStageStarted: stageStarted,
      recordStageFinished: stageFinished,
    },
    admitEffect: async () => ({ kind: "dispatch" as const }),
    projectOutput: () => ({ status: "completed" }),
  };
  if (kind === "action") {
    await runDurableGraphWorkflowV2(step, {
      ...common,
      capabilityRegistry: {
        [capability]: {
          kind: "action",
          ref: actionRef,
          effectClass: "external",
          authorization: externalAuthorization,
          effectContract,
          instanceKey: () => "instance-1",
          buildArgs: ({ logicalEffectKey }) => ({ logicalEffectKey }),
        },
      },
      currentAuthority: generatedCurrentAuthority,
    });
  } else if (kind === "query") {
    await runDurableGraphWorkflowV2(step, {
      ...common,
      capabilityRegistry: {
        [capability]: {
          kind: "query",
          ref: queryRef,
          effectClass: "none",
          buildArgs: () => ({}),
        },
      },
    });
  } else {
    await runDurableGraphWorkflowV2(step, {
      ...common,
      capabilityRegistry: {
        [capability]: {
          kind: "mutation",
          ref: mutationRef,
          effectClass: "none",
          buildArgs: () => ({}),
        },
      },
    });
  }
  return observed;
};

const graph = (
  functionKind: "query" | "mutation" | "action",
): DurableWorkflowGraphV2 => ({
  schemaVersion: 2,
  id: "observed-stage-v2",
  version: 2,
  startNodeId: "source",
  argsSchemaName: "fixture.args",
  returnSchemaName: "fixture.returns",
  principalSchemaName: "fixture.principal",
  policyPosture: { kind: "none", reason: "fixture" },
  kickoffProfiles: [
    { name: "interactive", mode: "eager-first-poll", default: true },
  ],
  unstableArgs: { enabled: false },
  nodes: [
    {
      id: "source",
      kind: "source",
      label: "source",
      stepName: "start.v2",
      payloadPolicy,
      semanticRuleIds: [],
    },
    functionKind === "action"
      ? {
          ...capabilityNode,
          functionKind,
          capability,
        }
      : {
          ...capabilityNode,
          functionKind,
          capability,
          transaction: { kind: "independent" },
        },
    {
      id: "output",
      kind: "output",
      label: "output",
      stepName: "output.v2",
      payloadPolicy,
      semanticRuleIds: [],
    },
  ],
  edges: [
    { id: "source-work", sourceNodeId: "source", targetNodeId: "work" },
    { id: "work-output", sourceNodeId: "work", targetNodeId: "output" },
  ],
  joins: [],
});

const payloadPolicy = {
  maxInputBytes: 1024,
  maxResultBytes: 1024,
  resultMode: "inline" as const,
};

const capabilityNode = {
  id: "work",
  kind: "capability" as const,
  label: "work",
  stepName: "work.v2",
  payloadPolicy,
  semanticRuleIds: [],
  failurePolicy: { kind: "fail" as const },
};

const effectContract = {
  strategy: "non-retriable",
  effectClass: "external",
  reason: "fixture has no safe retry contract",
  ambiguousOutcome: "manual-review",
  redactionPolicyRef: "redaction.fixture",
  guards: {
    approval: { kind: "not-applicable", reason: "fixture" },
    quotaRate: { kind: "not-applicable", reason: "fixture" },
    spendKillSwitch: { kind: "not-applicable", reason: "fixture" },
  },
} satisfies WorkflowEffectContract;
