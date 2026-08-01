import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempRepo } from "./src/check-test-helpers.mts";
import {
  descriptor,
  evaluateProductJourneyGate,
} from "./check-product-journeys.mts";

const manifest = () => ({
  journeyProtocolVersion: 1,
  id: "activation",
  version: 1,
  title: "Activate",
  status: "assembling",
  releaseProof: "deterministic-only",
  coverageProfile: "read-only",
  actor: "administrator",
  goal: "activate",
  releaseEntrypoints: ["entry.ts"],
  scenarios: [
    "success",
    "empty",
    "authorization_denial",
    "user_visible_failure",
  ].map((scenarioClass) => ({
    id: scenarioClass,
    scenarioClass,
    initialState: "ready",
    interactions: ["activate"],
    terminalOutcome: "active",
    requiredReceiptKinds: ["activation.v1"],
    forbiddenOutcomes: ["bypass"],
    fixtureMetadata: { fixture: "activation-v1", assertion: "activation-v1" },
    requiresDeployedProof: false,
  })),
  graph: {
    start: "start",
    terminal: "done",
    nodes: [
      { id: "start", kind: "interaction" },
      { id: "done", kind: "terminal" },
    ],
    edges: [
      {
        id: "activate",
        from: "start",
        to: "done",
        receiptKind: "activation.v1",
      },
    ],
  },
  requiredReceiptKinds: ["activation.v1"],
  dependsOnJourneys: [],
  affectedPaths: ["entry.ts"],
  workPackageRefs: ["WP-1"],
  owner: "owner@example.test",
});

const inventory = () => ({
  releaseEntrypoints: ["entry.ts"],
  receiptProducers: [{ receiptKind: "activation.v1", path: "producer.ts" }],
  receiptConsumers: [
    { receiptKind: "activation.v1", path: "assertion.test.ts" },
  ],
  frontiers: [],
  legacyEntrypoints: [],
  classifiedPaths: ["entry.ts"],
  surfaceAuthorities: [
    {
      path: "entry.ts",
      journeyId: "activation",
      authority: "read",
      transport: "local",
    },
  ],
  today: "2026-08-01",
});

const input = () => ({
  descriptor: {
    catalogSource: "catalog.json",
    inventorySource: "inventory.json",
    mergeBaseContractSource: "baseline.json",
    migrationLedgerSource: "journey-id-migrations.json",
    scanMechanisms: [
      "catalog-module",
      "generated-inventory",
      "journey-id-migrations",
      "merge-base-contracts",
    ],
  },
  catalog: [manifest()],
  baselineCatalog: [manifest()],
  inventory: inventory(),
  migrationLedger: [],
});
const adapterSource = (value: unknown): string =>
  `export async function loadProductJourneyInputs() { return ${JSON.stringify(value)}; }`;
const adapterFiles = (value: unknown): Record<string, string> => ({
  "adapter.mjs": adapterSource(value),
  "catalog.json": "{}",
  "inventory.json": "{}",
  "baseline.json": "{}",
  "journey-id-migrations.json": "[]",
});

describe("check:product-journeys", () => {
  it("pins the canonical command without placing it in root verify", () => {
    expect(descriptor.name).toBe("check:product-journeys");
    const packageRequirement = descriptor.requirements.find(
      ({ file }) => file === "package.json",
    );
    expect(packageRequirement?.includes).toContain("check:product-journeys");
    expect(packageRequirement?.includes).not.toContain(
      "pnpm check:product-journeys",
    );
  });

  it.each([
    ["missing adapter", undefined, "ADAPTER_MISSING"],
    ["unreadable adapter", "missing-adapter.mjs", "ADAPTER_UNREADABLE"],
  ])("fails closed for %s", async (_label, adapterPath, code) => {
    const result = await evaluateProductJourneyGate({
      repoRoot: process.cwd(),
      adapterPath,
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code }] });
  });

  it("fails closed for missing catalog or inventory", async () => {
    await withTempRepo(adapterFiles({ catalog: [] }), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: "ADAPTER_INVALID" }],
      });
    });
  });

  it.each([
    [
      "absent descriptor",
      {
        catalog: [manifest()],
        baselineCatalog: [manifest()],
        inventory: inventory(),
      },
    ],
    [
      "empty descriptor",
      {
        ...input(),
        descriptor: {
          catalogSource: "",
          inventorySource: "",
          mergeBaseContractSource: "",
          scanMechanisms: [],
        },
      },
    ],
    [
      "unknown scan mechanism",
      {
        ...input(),
        descriptor: {
          ...input().descriptor,
          scanMechanisms: ["filesystem-glob"],
        },
      },
    ],
  ])("rejects an %s", async (_label, gateInput) => {
    await withTempRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: "ADAPTER_INVALID" }],
      });
    });
  });

  it("rejects an unreadable descriptor source", async () => {
    const files = adapterFiles(input());
    delete files["inventory.json"];
    await withTempRepo(files, async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: "ADAPTER_INVALID" }],
      });
    });
  });

  it("rejects empty catalog and generated inventory inputs", async () => {
    const gateInput = input();
    gateInput.catalog = [];
    gateInput.baselineCatalog = [];
    gateInput.inventory.releaseEntrypoints = [];
    gateInput.inventory.classifiedPaths = [];
    await withTempRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: "ADAPTER_INVALID" }],
      });
    });
  });

  it("rejects journey deletion or rename without a protected migration ledger entry", async () => {
    const gateInput = input();
    gateInput.catalog[0]!.id = "activation-v2";
    await withTempRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COVERAGE_REDUCED",
            journeyId: "activation",
            message: expect.stringContaining("migration ledger"),
          }),
        ]),
      );
    });
  });

  it("accepts an approved immutable-id migration without resetting contract state", async () => {
    const gateInput = input();
    gateInput.catalog[0]!.id = "activation-v2";
    gateInput.inventory.surfaceAuthorities[0]!.journeyId = "activation-v2";
    gateInput.migrationLedger = [
      {
        fromJourneyId: "activation",
        toJourneyIds: ["activation-v2"],
        baselineVersion: 1,
        approval: "contract-review-123",
        reason: "canonical rename",
      },
    ];
    await withTempRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toEqual({ ok: true, diagnostics: [] });
    });
  });

  it("rejects an unapproved journey-id migration ledger entry", async () => {
    const gateInput = input();
    gateInput.migrationLedger = [
      {
        fromJourneyId: "activation",
        toJourneyIds: ["activation-v2"],
        baselineVersion: 1,
        approval: "",
        reason: "rename",
      },
    ];
    await withTempRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: "ADAPTER_INVALID" }],
      });
    });
  });

  it("reports a malformed manifest from the repository adapter", async () => {
    await withTempRepo(
      adapterFiles({ ...input(), catalog: [{}] }),
      async (repoRoot) => {
        const result = await evaluateProductJourneyGate({
          repoRoot,
          adapterPath: "adapter.mjs",
        });
        expect(result).toMatchObject({
          ok: false,
          diagnostics: [{ code: "MANIFEST_INVALID" }],
        });
      },
    );
  });

  it("reports an unowned generated release surface", async () => {
    const gateInput = input();
    gateInput.inventory.releaseEntrypoints.push("unowned.ts");
    gateInput.inventory.classifiedPaths.push("unowned.ts");
    await withTempRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          expect.objectContaining({
            code: "ENTRYPOINT_UNMAPPED",
            path: "unowned.ts",
          }),
        ],
      });
    });
  });

  it("compares current contracts with the baseline", async () => {
    const gateInput = input();
    gateInput.catalog[0]!.scenarios[0]!.terminalOutcome = "weakened";
    await withTempRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COVERAGE_REDUCED",
            journeyId: "activation",
          }),
        ]),
      );
    });
  });

  it("accepts a valid fixture-backed adapter through the command", async () => {
    await withTempRepo(adapterFiles(input()), async (repoRoot) => {
      const command = spawnSync(
        "pnpm",
        [
          "check:product-journeys",
          "--",
          "--repo-root",
          repoRoot,
          "--adapter",
          join(repoRoot, "adapter.mjs"),
        ],
        { cwd: process.cwd(), encoding: "utf8" },
      );
      expect(command.status, command.stderr).toBe(0);
      expect(command.stdout).toContain("check:product-journeys: ok");
    });
  });

  it("makes the default command fail with a typed missing-adapter diagnostic", () => {
    const command = spawnSync("pnpm", ["check:product-journeys"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(command.status).toBe(1);
    expect(`${command.stdout}${command.stderr}`).toContain("ADAPTER_MISSING");
  });
});
