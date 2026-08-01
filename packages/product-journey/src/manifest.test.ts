import { describe, expect, it } from "vitest";
import {
  parseProductJourneyManifest,
  validateJourneyCatalog,
} from "./manifest";

const requiredScenarioClasses = [
  "success",
  "empty",
  "authorization_denial",
  "user_visible_failure",
  "mutation_failure",
  "retry",
  "exact_replay",
  "partial_progress",
  "recovery",
  "tenant_isolation",
  "unsafe_input_refusal",
  "deletion_or_revocation",
  "historical_version",
  "migration_or_backfill",
  "deployed_proof",
] as const;

const highRiskManifest = () => ({
  journeyProtocolVersion: 1,
  id: "workspace-data-export",
  version: 1,
  title: "Export workspace data",
  status: "assembling",
  releaseProof: "deployed-proof-required",
  coverageProfile: "high-risk",
  actor: "workspace administrator",
  goal: "export authorized workspace data",
  releaseEntrypoints: ["exports.start"],
  scenarios: requiredScenarioClasses.map((scenarioClass) => ({
    id: `export-${scenarioClass}`,
    scenarioClass,
    initialState: "authorized synthetic workspace",
    interactions: ["start export"],
    terminalOutcome: "export result is visible",
    requiredReceiptKinds: ["export.requested.v1"],
    forbiddenOutcomes: ["cross-tenant data exposure"],
    fixtureMetadata: { persona: "synthetic-admin" } as Record<string, unknown>,
    requiresDeployedProof: scenarioClass === "deployed_proof",
  })),
  graph: {
    start: "request",
    terminal: "complete",
    nodes: [
      { id: "request", kind: "interaction" },
      { id: "complete", kind: "terminal" },
    ],
    edges: [
      {
        id: "request-to-complete",
        from: "request",
        to: "complete",
        receiptKind: "export.requested.v1",
      },
    ],
  },
  requiredReceiptKinds: ["export.requested.v1"],
  dependsOnJourneys: [],
  affectedPaths: ["packages/exports/**"],
  workPackageRefs: ["T1"],
  owner: "platform@example.test",
});

const highRiskWithout = (scenarioClass: string) => ({
  ...highRiskManifest(),
  scenarios: highRiskManifest().scenarios.filter(
    (scenario) => scenario.scenarioClass !== scenarioClass,
  ),
});

const withDanglingEdge = () => ({
  ...highRiskManifest(),
  graph: {
    ...highRiskManifest().graph,
    edges: [
      {
        id: "request-to-missing",
        from: "request",
        to: "missing",
        receiptKind: "export.requested.v1",
      },
    ],
  },
});

describe("parseProductJourneyManifest", () => {
  it("preserves a declared legacy exposure", () => {
    const manifest = parseProductJourneyManifest({
      ...highRiskManifest(),
      status: "legacy_exposed",
      legacyExposure: {
        existingEntrypoints: ["exports.start"],
        removalMilestone: "2026-12-31",
      },
    });

    expect(manifest.legacyExposure).toEqual({
      existingEntrypoints: ["exports.start"],
      removalMilestone: "2026-12-31",
    });
  });

  it.each([
    "tenant_isolation",
    "unsafe_input_refusal",
    "deletion_or_revocation",
    "historical_version",
    "migration_or_backfill",
    "deployed_proof",
  ])("rejects a high-risk manifest without %s coverage", (scenarioClass) => {
    expect(() =>
      parseProductJourneyManifest(highRiskWithout(scenarioClass)),
    ).toThrowError(new RegExp(scenarioClass));
  });

  it("rejects duplicate graph node ids", () => {
    const manifest = highRiskManifest();
    manifest.graph.nodes = [
      ...manifest.graph.nodes,
      { id: "request", kind: "interaction" },
    ];

    expect(() => parseProductJourneyManifest(manifest)).toThrowError(
      /duplicate graph node id/,
    );
  });

  it("rejects dangling graph edges", () => {
    expect(() => parseProductJourneyManifest(withDanglingEdge())).toThrowError(
      /unknown graph node/,
    );
  });

  it("rejects dependency cycles", () => {
    expect(() =>
      parseProductJourneyManifest({
        ...highRiskManifest(),
        id: "alpha",
        dependsOnJourneys: [
          {
            id: "alpha",
            minimumVersion: 1,
            terminalReceiptKind: "export.requested.v1",
          },
        ],
      }),
    ).toThrowError(/dependency cycle/);
  });

  it("rejects dependency cycles spanning multiple manifests", () => {
    const alpha = parseProductJourneyManifest({
      ...highRiskManifest(),
      id: "alpha",
      dependsOnJourneys: [
        {
          id: "beta",
          minimumVersion: 1,
          terminalReceiptKind: "export.requested.v1",
        },
      ],
    });
    const beta = parseProductJourneyManifest({
      ...highRiskManifest(),
      id: "beta",
      dependsOnJourneys: [
        {
          id: "alpha",
          minimumVersion: 1,
          terminalReceiptKind: "export.requested.v1",
        },
      ],
    });

    expect(() => validateJourneyCatalog([alpha, beta])).toThrowError(
      /dependency cycle: alpha -> beta -> alpha/,
    );
  });

  it("rejects credentials in fixture metadata", () => {
    const manifest = highRiskManifest();
    manifest.scenarios[0]!.fixtureMetadata = { apiKey: "not-a-secret" };

    expect(() => parseProductJourneyManifest(manifest)).toThrowError(
      /credentials/i,
    );
  });

  it("rejects credentials in unknown manifest fields", () => {
    expect(() =>
      parseProductJourneyManifest({
        ...highRiskManifest(),
        integration: { apiKey: "not-a-secret" },
      }),
    ).toThrowError(/credentials/i);
  });

  it("rejects credentials nested under the graph", () => {
    expect(() =>
      parseProductJourneyManifest({
        ...highRiskManifest(),
        graph: {
          ...highRiskManifest().graph,
          instrumentation: { accessToken: "not-a-secret" },
        },
      }),
    ).toThrowError(/credentials/i);
  });

  it("requires graph.start to name an interaction node", () => {
    expect(() =>
      parseProductJourneyManifest({
        ...highRiskManifest(),
        graph: { ...highRiskManifest().graph, start: "complete" },
      }),
    ).toThrowError(/graph start must name an interaction node/);
  });

  it("requires graph.terminal to name a terminal node", () => {
    expect(() =>
      parseProductJourneyManifest({
        ...highRiskManifest(),
        graph: { ...highRiskManifest().graph, terminal: "request" },
      }),
    ).toThrowError(/graph terminal must name a terminal node/);
  });
});
