import { describe, expect, it } from "vitest";
import { generateCompleteBuildPackGraph } from "../confect/workflows/generateCompleteBuildPack.graph";
import {
  runDurableGraphWorkflow,
  type DurableGraphCapabilityEntry,
  type RunDurableGraphStep,
} from "../confect/workflows/_kit/graphRunner";

describe("generateCompleteBuildPack durable workflow scaffold", () => {
  it("checkpoints every premium Build Pack stage in order", () => {
    expect(generateCompleteBuildPackGraph.nodes.map(({ id }) => id)).toEqual([
      "start",
      "normalize",
      "challenge",
      "research",
      "design",
      "specify",
      "review",
      "compile",
      "map-to-maestro",
      "receipt",
    ]);
    expect(generateCompleteBuildPackGraph.edges).toHaveLength(9);
  });

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
      runAction: async (_ref, args) => ({
        stage: (args.node as { id?: string } | undefined)?.id ?? "unknown",
        status: "completed",
      }),
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
    const policySnapshot = { mode: "test" };

    const stageIds = generateCompleteBuildPackGraph.nodes
      .filter(({ kind }) => kind === "agent")
      .map(({ id }) => id);
    const capabilityRegistry = Object.fromEntries(
      stageIds.map((id) => [
        `buildPack.${id}`,
        {
          kind: "action" as const,
          ref: {} as DurableGraphCapabilityEntry<"action">["ref"],
          agentSeat: true as const,
        },
      ]),
    );

    const result = await runDurableGraphWorkflow(step, {
      graph: generateCompleteBuildPackGraph,
      inputs,
      policySnapshot,
      capabilityRegistry,
    });

    expect(result).toEqual({
      inputs,
      context: {
        start: inputs,
        normalize: { stage: "normalize", status: "completed" },
        challenge: { stage: "challenge", status: "completed" },
        research: { stage: "research", status: "completed" },
        design: { stage: "design", status: "completed" },
        specify: { stage: "specify", status: "completed" },
        review: { stage: "review", status: "completed" },
        compile: { stage: "compile", status: "completed" },
        "map-to-maestro": {
          stage: "map-to-maestro",
          status: "completed",
        },
      },
      policySnapshot,
    });
  });
});
