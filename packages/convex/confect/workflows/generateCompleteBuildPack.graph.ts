import type { DurableWorkflowGraph } from "./graph";

const stageIds = [
  "normalize",
  "challenge",
  "research",
  "design",
  "specify",
  "review",
  "compile",
  "map-to-maestro",
] as const;

const orderedIds = ["start", ...stageIds, "receipt"] as const;

export const generateCompleteBuildPackGraph = {
  id: "workflow_generateCompleteBuildPack",
  version: 2,
  startNodeId: "start",
  nodes: [
    {
      id: "start",
      kind: "source",
      label: "Entitlement-verified Build Pack request",
      retry: { maxAttempts: 1, backoffMs: 0 },
    },
    ...stageIds.map((id) => ({
      id,
      kind: "agent" as const,
      label: `Checkpoint ${id}`,
      agent: `buildPack.${id}`,
      retry: { maxAttempts: 3, backoffMs: 1_000 },
    })),
    {
      id: "receipt",
      kind: "output",
      label: "Canonical Build Pack and Trust Receipt",
      retry: { maxAttempts: 1, backoffMs: 0 },
    },
  ],
  edges: orderedIds.slice(0, -1).map((sourceNodeId, index) => ({
    id: `edge_${sourceNodeId}_${orderedIds[index + 1] ?? "receipt"}`,
    sourceNodeId,
    targetNodeId: orderedIds[index + 1] ?? "receipt",
  })),
  joins: [],
} satisfies DurableWorkflowGraph;
