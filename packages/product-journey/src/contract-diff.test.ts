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

  it("detects deletion of one duplicate-class scenario", () => {
    const retry = {
      ...base.scenarios[0]!,
      id: "retry-two",
      scenarioClass: "retry" as const,
    };
    const prior = {
      ...base,
      scenarios: [{ ...retry, id: "retry-one" }, retry],
    };
    const proposed = { ...prior, scenarios: [retry] };

    expect(diffJourneyContract(prior, proposed)).toEqual(
      expect.objectContaining({
        risk: "coverage_reduction",
        requiresApproval: true,
        reductions: expect.arrayContaining([
          expect.stringContaining("retry-one"),
        ]),
      }),
    );
  });

  it.each([
    ["scenario class", { scenarioClass: "retry" }],
    ["interactions", { interactions: ["different"] }],
    ["terminal outcome", { terminalOutcome: "different" }],
    ["scenario receipts", { requiredReceiptKinds: [] }],
    ["forbidden bypasses", { forbiddenOutcomes: [] }],
    ["fixture identity", { fixtureMetadata: { fixture: "changed" } }],
    ["deployed proof", { requiresDeployedProof: true }],
  ])("governs a semantic change to %s", (_label, scenarioChange) => {
    const proposed = {
      ...base,
      scenarios: [{ ...base.scenarios[0]!, ...scenarioChange }],
    } as ProductJourneyManifest;
    expect(diffJourneyContract(base, proposed).requiresApproval).toBe(true);
  });

  it("governs replay, retry, isolation, role, transport, and release-proof changes", () => {
    const scenarios = ["tenant_isolation", "retry", "exact_replay"].map(
      (scenarioClass, index) => ({
        ...base.scenarios[0]!,
        id: `${scenarioClass}-${index}`,
        scenarioClass,
      }),
    ) as ProductJourneyManifest["scenarios"];
    const prior = { ...base, actor: "admin|editor", scenarios };
    const proposed = {
      ...prior,
      actor: "admin",
      releaseProof: "deployed-proof-required" as const,
      releaseEntrypoints: [],
      scenarios: [],
    };
    expect(diffJourneyContract(prior, proposed).requiresApproval).toBe(true);
  });

  it("returns code-point sorted reductions without localeCompare", () => {
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = () => {
      throw new Error("localeCompare must not be used");
    };
    try {
      const result = diffJourneyContract(base, {
        ...base,
        actor: "member",
        scenarios: [],
      });
      expect(result.reductions).toEqual([...result.reductions].sort());
    } finally {
      String.prototype.localeCompare = original;
    }
  });

  it("governs coverage and proof downgrades", () => {
    const prior = {
      ...base,
      coverageProfile: "high-risk" as const,
      releaseProof: "deployed-proof-required" as const,
    };
    const proposed = {
      ...prior,
      coverageProfile: "read-only" as const,
      releaseProof: "deterministic-only" as const,
    };
    expect(diffJourneyContract(prior, proposed)).toEqual(
      expect.objectContaining({
        risk: "coverage_reduction",
        requiresApproval: true,
      }),
    );
  });
});
