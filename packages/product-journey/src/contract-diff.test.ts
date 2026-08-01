import { describe, expect, it } from "vitest";
import type { ProductJourneyManifest } from "./manifest";
import { diffJourneyContract } from "./contract-diff";

const base: ProductJourneyManifest = {
  journeyProtocolVersion: 1,
  id: "journey",
  version: 1,
  title: "Journey",
  status: "assembling",
  releaseProof: "deterministic-only",
  coverageProfile: "high-risk",
  actor: "admin",
  goal: "complete",
  releaseEntrypoints: ["entry.ts"],
  scenarios: [
    {
      id: "isolation",
      scenarioClass: "tenant_isolation",
      initialState: "ready",
      interactions: ["run"],
      terminalOutcome: "done",
      requiredReceiptKinds: ["receipt.v1"],
      forbiddenOutcomes: ["leak"],
      fixtureMetadata: {},
      requiresDeployedProof: false,
    },
  ],
  graph: {
    start: "start",
    terminal: "done",
    nodes: [
      { id: "start", kind: "interaction" },
      { id: "done", kind: "terminal" },
    ],
    edges: [
      { id: "edge", from: "start", to: "done", receiptKind: "receipt.v1" },
    ],
  },
  requiredReceiptKinds: ["receipt.v1"],
  dependsOnJourneys: [],
  affectedPaths: ["entry.ts"],
  workPackageRefs: ["WP-1"],
  owner: "owner@example.test",
};

describe("diffJourneyContract", () => {
  it("requires approval when roles, transports, negative scenarios, or isolation coverage is reduced", () => {
    const proposed = {
      ...base,
      actor: "member",
      releaseEntrypoints: [],
      scenarios: [],
      requiredReceiptKinds: [],
    };
    expect(diffJourneyContract(base, proposed)).toEqual(
      expect.objectContaining({
        risk: "coverage_reduction",
        requiresApproval: true,
      }),
    );
  });
});
