import * as Result from "effect/Result";
import { defineWorkflowGraphV2 } from "../_kit/workflowBuilder";
import { defineWorkflowReferenceRegistry } from "../_kit/workflowReferences";

export const publicationFixtureReferences = defineWorkflowReferenceRegistry({
  capabilities: { eventControl: "capability.workflowEventControl.v1" },
  workflows: { self: "workflow.publicationFixture.v2" },
  events: { approvalDecision: "event.approvalDecision.v1" },
});

export const publicationFixtureGraph = Result.getOrThrow(
  defineWorkflowGraphV2({
    id: "workflow_publicationFixture",
    version: 2,
    startNodeId: "start",
    argsSchemaName: "publicationFixture.v2.args",
    returnSchemaName: "publicationFixture.v2.return",
    principalSchemaName: "workflowPrincipal.v1",
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
        label: "publicationFixture start",
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
  }),
);
