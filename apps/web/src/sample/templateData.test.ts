import { describe, expect, it } from "vitest";
import {
  agents,
  brainSources,
  capabilities,
  durableWorkflowGraph,
  headlessSurfaces,
  openApiSummary,
  providerAdapters,
  sampleRunReceipt,
  safetyChecklist,
  starterReadiness,
} from "./templateData";

describe("template sample data", () => {
  it("uses workflow edges that reference declared nodes", () => {
    const nodeIds = new Set(durableWorkflowGraph.nodes.map((node) => node.id));

    for (const edge of durableWorkflowGraph.edges) {
      expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
      expect(nodeIds.has(edge.targetNodeId)).toBe(true);
    }
  });

  it("shows the core investor-review primitives", () => {
    expect(brainSources.length).toBeGreaterThanOrEqual(3);
    expect(capabilities.length).toBeGreaterThanOrEqual(3);
    expect(agents.length).toBeGreaterThanOrEqual(3);
    expect(headlessSurfaces.map((surface) => surface.name)).toContain(
      "Scalar API",
    );
    expect(providerAdapters.map((adapter) => adapter.name)).toContain(
      "WorkOS/AuthKit",
    );
    expect(safetyChecklist.join(" ")).toContain("Tenant identity");
  });

  it("derives the API docs summary from the generated OpenAPI artifact", () => {
    expect(openApiSummary).toEqual({
      version: "3.1.0",
      operationCount: 1,
      docsRoute: "/api/docs",
      typedErrors: [
        "Unauthorized",
        "MemberNotInWorkspace",
        "WorkspaceNotFound",
        "ValidationFailed",
      ],
      authScope: "workspace member",
    });
  });

  it("shows the deterministic workflow receipt used by headless surfaces", () => {
    expect(sampleRunReceipt).toMatchObject({
      runId: "run_template_001",
      workflowRunId: "run_template_001",
      workflowId: "workflow_source_grounded_plan",
      workflowName: "Source-grounded planning workflow",
      trustReceiptId: "trust_run_template_001",
      trustReceipt: {
        receiptId: "trust_run_template_001",
        trustClaim: "source-backed-no-default-rag",
      },
    });
    expect(sampleRunReceipt.steps).toHaveLength(
      durableWorkflowGraph.nodes.length,
    );
  });

  it("documents the Day-0 SaaS starter loop", () => {
    expect(starterReadiness.statuses.map((status) => status.label)).toEqual([
      "Hosted reference app",
      "Fake provider mode",
      "Generated headless surfaces",
      "Client fork packet",
      "Live provider setup",
    ]);
    expect(starterReadiness.dayZeroCommands).toEqual([
      'pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Client Brain" --write',
      "pnpm template:doctor -- --mode fake",
      "pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write",
      "pnpm template:add-client-domain -- --name customerContext --write",
      "pnpm template:handoff -- --mode fake --write",
    ]);
    expect(starterReadiness.dayZeroCommands[0]).toContain("--write");
    expect(starterReadiness.proofPoints.map((point) => point.label)).toContain(
      "API / CLI / MCP registry",
    );
  });

  it("keeps starter console proof points in structured sample data", () => {
    const proofText = [
      ...starterReadiness.statuses.map((status) => status.label),
      ...starterReadiness.proofPoints.map((point) => point.label),
      ...starterReadiness.dayZeroCommands,
    ].join(" ");

    expect(proofText).toContain("Hosted reference app");
    expect(proofText).toContain("pnpm template:quickstart");
    expect(proofText).toContain("API / CLI / MCP registry");
    expect(proofText).toContain("Live provider setup");
  });
});
