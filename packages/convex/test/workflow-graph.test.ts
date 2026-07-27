import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import workflowRunEvents from "../confect/tables/workflowRunEvents";
import workflowRunEvidenceSnapshots from "../confect/tables/workflowRunEvidenceSnapshots";
import workflowRunContextManifests from "../confect/tables/workflowRunContextManifests";
import workflowRunLinks from "../confect/tables/workflowRunLinks";
import workflowRuns, { WorkflowRunRow } from "../confect/tables/workflowRuns";
import workflowStageRuns from "../confect/tables/workflowStageRuns";
import {
  DurableWorkflowGraph,
  WorkflowGraphValidationError,
  validateWorkflowGraph,
} from "../confect/workflows/graph";

const validGraph = {
  id: "workflow_source_grounded_plan",
  version: 1,
  startNodeId: "source",
  nodes: [
    {
      id: "source",
      kind: "source",
      label: "Source Set",
      retry: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: "brief",
      kind: "capability",
      label: "Source Grounded Brief",
      capability: "sourceGroundedBrief",
      retry: { maxAttempts: 2, backoffMs: 250 },
    },
    {
      id: "receipt",
      kind: "output",
      label: "Trust Receipt",
      retry: { maxAttempts: 1, backoffMs: 0 },
    },
  ],
  edges: [
    {
      id: "edge_source_brief",
      sourceNodeId: "source",
      targetNodeId: "brief",
    },
    {
      id: "edge_brief_receipt",
      sourceNodeId: "brief",
      targetNodeId: "receipt",
      condition: {
        expression:
          "context.brief.trustClaim === 'source-backed-no-default-rag'",
      },
    },
  ],
  joins: [
    {
      nodeId: "receipt",
      strategy: "all-successful",
      sourceNodeIds: ["brief"],
    },
  ],
} satisfies DurableWorkflowGraph;

const firstNode = validGraph.nodes[0];

if (!firstNode) {
  throw new Error("validGraph must include a first node");
}

describe("workflow graph model", () => {
  it("validates a durable graph without React Flow state", () => {
    expect(validateWorkflowGraph(validGraph)).toEqual([]);
    expect(JSON.stringify(validGraph)).not.toContain("position");
    expect(JSON.stringify(validGraph)).not.toContain("reactFlow");
  });

  it("rejects a missing start node", () => {
    expect(
      validateWorkflowGraph({
        ...validGraph,
        startNodeId: "missing",
      }),
    ).toContainEqual(
      new WorkflowGraphValidationError.MissingStartNode({
        startNodeId: "missing",
      }),
    );
  });

  it("rejects dangling edge endpoints", () => {
    expect(
      validateWorkflowGraph({
        ...validGraph,
        edges: [
          ...validGraph.edges,
          {
            id: "edge_dangling",
            sourceNodeId: "brief",
            targetNodeId: "missing",
          },
        ],
      }),
    ).toContainEqual(
      new WorkflowGraphValidationError.DanglingEdge({
        edgeId: "edge_dangling",
        nodeId: "missing",
      }),
    );
  });

  it("rejects duplicate edge identifiers", () => {
    expect(
      validateWorkflowGraph({
        ...validGraph,
        edges: [
          ...validGraph.edges,
          {
            id: "edge_source_brief",
            sourceNodeId: "source",
            targetNodeId: "receipt",
          },
        ],
      }),
    ).toContainEqual(
      new WorkflowGraphValidationError.DuplicateEdgeId({
        edgeId: "edge_source_brief",
      }),
    );
  });

  it("rejects invalid retry config", () => {
    expect(
      validateWorkflowGraph({
        ...validGraph,
        nodes: [
          {
            ...firstNode,
            retry: { maxAttempts: 0, backoffMs: -1 },
          },
          ...validGraph.nodes.slice(1),
        ],
      }),
    ).toEqual([
      new WorkflowGraphValidationError.InvalidRetryConfig({
        nodeId: "source",
        field: "maxAttempts",
      }),
      new WorkflowGraphValidationError.InvalidRetryConfig({
        nodeId: "source",
        field: "backoffMs",
      }),
    ]);
  });

  it("rejects invalid delay config", () => {
    expect(
      validateWorkflowGraph({
        ...validGraph,
        nodes: [
          {
            ...firstNode,
            kind: "delay",
            delayMs: 0,
          },
          ...validGraph.nodes.slice(1),
        ],
      }),
    ).toContainEqual(
      new WorkflowGraphValidationError.InvalidDelayConfig({
        nodeId: "source",
        field: "delayMs",
      }),
    );
  });

  it("rejects invalid joins", () => {
    expect(
      validateWorkflowGraph({
        ...validGraph,
        joins: [
          {
            nodeId: "missing",
            strategy: "all-successful",
            sourceNodeIds: ["brief", "missing_source"],
          },
        ],
      }),
    ).toEqual([
      new WorkflowGraphValidationError.InvalidJoin({
        nodeId: "missing",
        reason: "join node is not in graph",
      }),
      new WorkflowGraphValidationError.InvalidJoin({
        nodeId: "missing_source",
        reason: "join source node is not in graph",
      }),
    ]);
  });

  it("rejects joins whose sources are not connected to the join node", () => {
    expect(
      validateWorkflowGraph({
        ...validGraph,
        joins: [
          {
            nodeId: "receipt",
            strategy: "all-successful",
            sourceNodeIds: ["source"],
          },
        ],
      }),
    ).toContainEqual(
      new WorkflowGraphValidationError.InvalidJoin({
        nodeId: "receipt",
        reason: "join source node source has no edge to join node",
      }),
    );
  });

  it("rejects V1 any-successful joins without a proven loser policy", () => {
    expect(
      validateWorkflowGraph({
        ...validGraph,
        joins: [
          {
            nodeId: "receipt",
            strategy: "any-successful",
            sourceNodeIds: ["brief"],
          },
        ],
      }),
    ).toContainEqual(
      new WorkflowGraphValidationError.InvalidJoin({
        nodeId: "receipt",
        reason:
          "any-successful join cannot prove losing work is resolved; use all-successful until a typed mutually-exclusive branch or loser policy is declared",
      }),
    );
  });

  it("rejects invalid condition expressions", () => {
    expect(
      validateWorkflowGraph({
        ...validGraph,
        edges: [
          {
            id: "edge_bad_condition",
            sourceNodeId: "source",
            targetNodeId: "brief",
            condition: { expression: "globalThis.process.exit()" },
          },
        ],
        joins: [],
      }),
    ).toEqual([
      new WorkflowGraphValidationError.InvalidConditionExpression({
        edgeId: "edge_bad_condition",
      }),
    ]);
  });

  it("declares workflow persistence table schemas and indexes", () => {
    expect(workflowRuns.indexes).toMatchObject({
      by_workspace_status: ["workspaceId", "status"],
      by_workflow_version: ["workflowId", "workflowVersion"],
      by_idempotency_key: ["workspaceId", "idempotencyKey"],
      by_component_workflow: ["componentWorkflowId"],
      by_workspace_component_workflow: ["workspaceId", "componentWorkflowId"],
    });
    expect(workflowStageRuns.indexes).toMatchObject({
      by_run: ["workflowRunId"],
      by_run_node: ["workflowRunId", "nodeId"],
      by_status: ["status"],
      by_component_workflow_order: ["componentWorkflowId", "order"],
      by_component_workflow_stage_attempt: [
        "componentWorkflowId",
        "stageKey",
        "attemptNumber",
      ],
    });
    expect(workflowRunLinks.indexes).toMatchObject({
      by_workspace_and_parent: ["workspaceId", "parentWorkflowId"],
      by_workspace_and_child: ["workspaceId", "childWorkflowId"],
      by_workspace_and_idempotency: ["workspaceId", "idempotencyKey"],
    });
    expect(workflowRunEvents.indexes).toMatchObject({
      by_run_sequence: ["workflowRunId", "sequence"],
      by_run_type: ["workflowRunId", "type"],
    });
    expect(workflowRunEvidenceSnapshots.indexes).toMatchObject({
      by_run: ["workflowRunId"],
      by_hash: ["evidenceHash"],
    });
    expect(workflowRunContextManifests.indexes).toMatchObject({
      by_run: ["workflowRunId"],
      by_manifest_hash: ["manifestHash"],
    });
  });

  it("decodes a durable graph and run row shape", () => {
    expect(Schema.decodeUnknownSync(DurableWorkflowGraph)(validGraph)).toEqual(
      validGraph,
    );
    expect(
      Schema.decodeUnknownSync(WorkflowRunRow)({
        workspaceId: "workspace_123",
        workflowId: "workflow_source_grounded_plan",
        workflowVersion: 1,
        graphJson: JSON.stringify(validGraph),
        status: "completed",
        idempotencyKey: "run-001",
        startedByUserId: "user_123",
        startedAt: 1,
        completedAt: 2,
        failedAt: null,
        trustReceiptId: "trust_receipt_123",
      }),
    ).toMatchObject({
      workspaceId: "workspace_123",
      status: "completed",
      trustReceiptId: "trust_receipt_123",
    });
  });
});
