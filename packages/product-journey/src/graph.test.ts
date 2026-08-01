import { describe, expect, it } from "vitest";
import type { ProductJourneyManifest } from "./manifest";
import { validateJourneyCatalog } from "./graph";

const journey = (
  overrides: Partial<ProductJourneyManifest> = {},
): ProductJourneyManifest => ({
  journeyProtocolVersion: 1,
  id: "activation",
  version: 2,
  title: "Activate a workspace",
  status: "assembling",
  releaseProof: "deterministic-only",
  coverageProfile: "read-only",
  actor: "administrator",
  goal: "activate the workspace",
  releaseEntrypoints: ["apps/web/src/routes/activate.tsx"],
  scenarios: [
    {
      id: "success",
      scenarioClass: "success",
      initialState: "ready",
      interactions: ["activate"],
      terminalOutcome: "active",
      requiredReceiptKinds: ["activation.v1"],
      forbiddenOutcomes: [],
      fixtureMetadata: {},
      requiresDeployedProof: false,
    },
    {
      id: "empty",
      scenarioClass: "empty",
      initialState: "empty",
      interactions: ["activate"],
      terminalOutcome: "empty",
      requiredReceiptKinds: ["activation.v1"],
      forbiddenOutcomes: [],
      fixtureMetadata: {},
      requiresDeployedProof: false,
    },
    {
      id: "denied",
      scenarioClass: "authorization_denial",
      initialState: "denied",
      interactions: ["activate"],
      terminalOutcome: "denied",
      requiredReceiptKinds: ["activation.v1"],
      forbiddenOutcomes: [],
      fixtureMetadata: {},
      requiresDeployedProof: false,
    },
    {
      id: "failure",
      scenarioClass: "user_visible_failure",
      initialState: "failed",
      interactions: ["activate"],
      terminalOutcome: "failed",
      requiredReceiptKinds: ["activation.v1"],
      forbiddenOutcomes: [],
      fixtureMetadata: {},
      requiresDeployedProof: false,
    },
  ],
  graph: {
    start: "start",
    terminal: "done",
    nodes: [
      { id: "start", kind: "interaction" },
      { id: "boundary", kind: "boundary" },
      { id: "done", kind: "terminal" },
    ],
    edges: [
      {
        id: "to-boundary",
        from: "start",
        to: "boundary",
        receiptKind: "activation.v1",
      },
      {
        id: "to-done",
        from: "boundary",
        to: "done",
        receiptKind: "completed.v1",
      },
    ],
  },
  requiredReceiptKinds: ["activation.v1", "completed.v1"],
  dependsOnJourneys: [],
  affectedPaths: ["apps/web/src/routes/activate.tsx"],
  workPackageRefs: ["WP-1"],
  owner: "owner@example.test",
  ...overrides,
});

describe("validateJourneyCatalog", () => {
  it("validates release entrypoints in both directions", () => {
    const diagnostics = validateJourneyCatalog(
      [
        journey({
          releaseEntrypoints: ["manifest-only.ts"],
          graph: { ...journey().graph, edges: [] },
        }),
      ],
      {
        releaseEntrypoints: ["inventory-only.ts"],
        receiptProducers: [],
        receiptConsumers: [],
        frontiers: [],
        legacyEntrypoints: [],
        today: "2026-08-01",
      },
    );

    expect(diagnostics.map(({ code, path }) => [code, path])).toEqual([
      ["ENTRYPOINT_UNMAPPED", "manifest-only.ts"],
      ["ENTRYPOINT_UNMAPPED", "inventory-only.ts"],
    ]);
  });

  it("rejects manifest and generated reachability beyond a legacy baseline", () => {
    const diagnostics = validateJourneyCatalog(
      [
        journey({
          status: "legacy_exposed",
          releaseEntrypoints: ["legacy.ts", "new.ts"],
          legacyExposure: {
            existingEntrypoints: ["legacy.ts"],
            removalMilestone: "2027-01-01",
          },
          graph: { ...journey().graph, edges: [] },
        }),
      ],
      {
        releaseEntrypoints: ["legacy.ts", "new.ts"],
        receiptProducers: [],
        receiptConsumers: [],
        frontiers: [],
        legacyEntrypoints: ["legacy.ts", "new.ts"],
        today: "2026-08-01",
      },
    );

    expect(diagnostics.map(({ code, path }) => [code, path])).toEqual([
      ["LEGACY_EXPANSION", "new.ts"],
      ["LEGACY_EXPANSION", "new.ts"],
    ]);
  });

  it("does not use locale-sensitive diagnostic ordering", () => {
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = () => {
      throw new Error("localeCompare must not be used");
    };
    try {
      expect(
        validateJourneyCatalog([], {
          releaseEntrypoints: ["z.ts", "a.ts"],
          receiptProducers: [],
          receiptConsumers: [],
          frontiers: [],
          legacyEntrypoints: [],
          today: "2026-08-01",
        }).map(({ path }) => path),
      ).toEqual(["a.ts", "z.ts"]);
    } finally {
      String.prototype.localeCompare = original;
    }
  });

  it("derives minimum coverage and release proof from surface authority", () => {
    const diagnostics = validateJourneyCatalog([journey()], {
      releaseEntrypoints: ["apps/web/src/routes/activate.tsx"],
      receiptProducers: [
        { receiptKind: "activation.v1", path: "producer.ts" },
        { receiptKind: "completed.v1", path: "producer.ts" },
      ],
      receiptConsumers: [
        { receiptKind: "activation.v1", path: "consumer.ts" },
        { receiptKind: "completed.v1", path: "consumer.ts" },
      ],
      frontiers: [],
      legacyEntrypoints: [],
      today: "2026-08-01",
      surfaceAuthorities: [
        {
          path: "apps/web/src/routes/activate.tsx",
          journeyId: "activation",
          authority: "async",
          transport: "non_local",
        },
      ],
    });
    expect(diagnostics.map(({ code, message }) => [code, message])).toEqual([
      ["COVERAGE_REDUCED", expect.stringContaining("high-risk")],
      ["COVERAGE_REDUCED", expect.stringContaining("deployed-proof-required")],
    ]);
  });

  it("reports graph and dependency violations with stable diagnostic codes", () => {
    const dependent = journey({
      id: "dependent",
      dependsOnJourneys: [
        {
          id: "activation",
          minimumVersion: 3,
          terminalReceiptKind: "completed.v1",
        },
      ],
    });
    const diagnostics = validateJourneyCatalog([journey(), dependent], {
      releaseEntrypoints: [
        "apps/web/src/routes/activate.tsx",
        "apps/web/src/routes/unmapped.tsx",
      ],
      receiptProducers: [
        { receiptKind: "activation.v1", path: "producer.ts" },
        { receiptKind: "activation.v1", path: "other-producer.ts" },
      ],
      receiptConsumers: [],
      frontiers: [
        {
          journeyId: "activation",
          reachedNode: "start",
          previousReachedNode: "boundary",
        },
      ],
      legacyEntrypoints: [],
      today: "2026-08-01",
    });

    expect(diagnostics.map(({ code }) => code)).toEqual([
      "DEPENDENCY_INCOMPATIBLE",
      "EDGE_CONSUMER_MISSING",
      "EDGE_CONSUMER_MISSING",
      "EDGE_CONSUMER_MISSING",
      "EDGE_CONSUMER_MISSING",
      "EDGE_PRODUCER_INVALID",
      "EDGE_PRODUCER_INVALID",
      "EDGE_PRODUCER_INVALID",
      "EDGE_PRODUCER_INVALID",
      "ENTRYPOINT_UNMAPPED",
      "FRONTIER_REGRESSION",
    ]);
  });

  it("rejects expanding or expired legacy exposure", () => {
    const diagnostics = validateJourneyCatalog(
      [
        journey({
          status: "legacy_exposed",
          legacyExposure: {
            existingEntrypoints: ["legacy.ts", "new.ts"],
            removalMilestone: "2026-01-01",
          },
        }),
      ],
      {
        releaseEntrypoints: ["apps/web/src/routes/activate.tsx"],
        receiptProducers: [
          { receiptKind: "activation.v1", path: "producer.ts" },
          { receiptKind: "completed.v1", path: "producer.ts" },
        ],
        receiptConsumers: [
          { receiptKind: "activation.v1", path: "consumer.ts" },
          { receiptKind: "completed.v1", path: "consumer.ts" },
        ],
        frontiers: [],
        legacyEntrypoints: ["legacy.ts"],
        today: "2026-08-01",
      },
    );
    expect(diagnostics.map(({ code }) => code)).toEqual([
      "LEGACY_EXPANSION",
      "LEGACY_MILESTONE_EXPIRED",
    ]);
  });

  it("reports release surfaces that the inventory cannot classify", () => {
    const diagnostics = validateJourneyCatalog([journey()], {
      releaseEntrypoints: ["apps/web/src/routes/activate.tsx"],
      receiptProducers: [
        { receiptKind: "activation.v1", path: "producer.ts" },
        { receiptKind: "completed.v1", path: "producer.ts" },
      ],
      receiptConsumers: [
        { receiptKind: "activation.v1", path: "consumer.ts" },
        { receiptKind: "completed.v1", path: "consumer.ts" },
      ],
      frontiers: [],
      legacyEntrypoints: [],
      today: "2026-08-01",
      classifiedPaths: [],
    });
    expect(diagnostics.map(({ code }) => code)).toEqual([
      "SURFACE_UNCLASSIFIED",
    ]);
  });
});
