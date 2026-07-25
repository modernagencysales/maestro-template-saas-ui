import { describe, expect, it } from "vitest";
import { publicationFixtureGraph } from "../confect/workflows/publicationFixture/v1.graph";
import {
  runDurableGraphWorkflowV2,
  type RunDurableGraphStep,
} from "../confect/workflows/_kit/graphRunner";

describe("publicationFixture durable workflow scaffold", () => {
  it("runs the generated source-to-output graph", async () => {
    const step: RunDurableGraphStep = {
      runQuery: async () => {
        throw new Error(
          "Generated source/output graph should not run queries.",
        );
      },
      runMutation: async () => {
        throw new Error(
          "Generated source/output graph should not run mutations.",
        );
      },
      runAction: async () => {
        throw new Error(
          "Generated source/output graph should not run actions.",
        );
      },
      sleep: async () => {},
      awaitEvent: async () => {
        throw new Error(
          "Generated source/output graph should not await events.",
        );
      },
    };

    const inputs = {
      workspaceId: "workspace_123",
      idempotencyKey: "workflow-test-1",
    };

    const result = await runDurableGraphWorkflowV2(step, {
      graph: publicationFixtureGraph,
      inputs,
      principal: {
        version: 1,
        kind: "system",
        workspaceId: inputs.workspaceId,
        systemId: "workflow-test",
        reason: "fixture",
        grants: [],
        kickoffAt: 1,
      },
      policySnapshot: { kind: "none", reason: "fixture" },
      projectOutput: () => ({
        workflowId: publicationFixtureGraph.id,
        status: "completed" as const,
      }),
    });

    expect(result).toEqual({
      workflowId: publicationFixtureGraph.id,
      status: "completed",
    });
  });
});
