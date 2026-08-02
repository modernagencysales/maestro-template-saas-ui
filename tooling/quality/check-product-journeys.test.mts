import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempRepo } from "./src/check-test-helpers.mts";
import { canonicalStringify } from "../../packages/product-journey/src/ordering";
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
  receiptProducers: [
    {
      journeyId: "activation",
      from: "start",
      to: "done",
      receiptKind: "activation.v1",
      contractIdentity: "activate",
      path: "producer.ts",
    },
  ],
  receiptConsumers: [
    {
      journeyId: "activation",
      from: "start",
      to: "done",
      receiptKind: "activation.v1",
      contractIdentity: "activate",
      path: "assertion.test.ts",
    },
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
    approvalIdentitySource: "approval-identities.json",
    scanMechanisms: [
      "catalog-module",
      "generated-inventory",
      "journey-id-migrations",
      "merge-base-contracts",
      "protected-approval-identities",
    ],
  },
  catalog: [manifest()],
  baselineCatalog: [manifest()],
  inventory: inventory(),
  migrationLedger: [],
});
const adapterSource = (value: unknown): string =>
  `export async function loadProductJourneyInputs() { return ${JSON.stringify(value)}; }`;
const digest = (value: unknown): string =>
  createHash("sha256").update(canonicalStringify(value)).digest("hex");
const approvalArtifact = { approved: true, scope: "journey-id-migration" };
const approvalIdentities = { reviewerIdentities: ["contract-owner"] };
const workspaceRoot = join(import.meta.dirname, "../..");
const first = <T,>(values: readonly T[]): T => {
  const value = values[0];
  if (value === undefined) throw new Error("test fixture is missing an item");
  return value;
};
const installClosedMigration = (
  gateInput: ReturnType<typeof input>,
  {
    reviewerIdentity = "contract-owner",
    reason = "canonical rename",
  }: { reviewerIdentity?: string; reason?: string } = {},
) => {
  const predecessor = first(gateInput.baselineCatalog);
  const successors = gateInput.catalog;
  const continuity = {
    fromJourneyId: predecessor.id,
    toJourneyIds: successors.map(({ id }) => id),
    baselineVersion: predecessor.version,
    predecessorContractHash: digest(predecessor),
    successorContractHashes: successors.map(digest),
    predecessorAttestationIdentity: `attestation:${predecessor.id}:${predecessor.version}`,
    successorAttestationIdentities: successors.map(
      ({ id, version }) => `attestation:${id}:${version}`,
    ),
    predecessorLeaseContinuityIdentity: `lease:${predecessor.id}:${predecessor.version}`,
    successorLeaseContinuityIdentities: successors.map(
      ({ id, version }) => `lease:${id}:${version}`,
    ),
    reason,
  };
  const artifact = {
    approvalScope: "product-journey-id-migration" as const,
    decision: "approved" as const,
    reviewerIdentity,
    ...continuity,
  };
  gateInput.migrationLedger = [
    {
      ...continuity,
      approval: {
        artifactSource: "migration-approval.json",
        artifactDigest: digest(artifact),
        reviewerIdentity,
      },
    },
  ];
  return artifact;
};
const adapterFiles = (
  value: unknown,
  migrationApprovalArtifact: unknown = approvalArtifact,
): Record<string, string> => {
  const bound = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  const descriptorValue = bound.descriptor;
  if (
    typeof descriptorValue === "object" &&
    descriptorValue !== null &&
    !Array.isArray(descriptorValue)
  ) {
    Object.assign(descriptorValue, {
      catalogDigest: digest(bound.catalog),
      inventoryDigest: digest(bound.inventory),
      mergeBaseContractDigest: digest(bound.baselineCatalog),
      migrationLedgerDigest: digest(bound.migrationLedger),
      approvalIdentityDigest: digest(approvalIdentities),
    });
  }
  return {
    "adapter.mjs": adapterSource(bound),
    "catalog.json": JSON.stringify(bound.catalog ?? {}),
    "inventory.json": JSON.stringify(bound.inventory ?? {}),
    "baseline.json": JSON.stringify(bound.baselineCatalog ?? {}),
    "journey-id-migrations.json": JSON.stringify(bound.migrationLedger ?? []),
    "approval-identities.json": JSON.stringify(approvalIdentities),
    "migration-approval.json": JSON.stringify(migrationApprovalArtifact),
  };
};

const withGateRepo = async <T,>(
  files: Record<string, string>,
  run: (repoRoot: string) => Promise<T>,
): Promise<T> =>
  withTempRepo(files, async (repoRoot) => {
    for (const args of [
      ["init", "-q"],
      ["config", "user.email", "gate@example.test"],
      ["config", "user.name", "Gate Test"],
      ["add", "."],
      ["commit", "-qm", "fixture baseline"],
      ["update-ref", "refs/remotes/origin/main", "HEAD"],
    ]) {
      const result = spawnSync("git", args, {
        cwd: repoRoot,
        encoding: "utf8",
      });
      if (result.status !== 0) throw new Error(result.stderr);
    }
    return run(repoRoot);
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
    await withGateRepo(adapterFiles({ catalog: [] }), async (repoRoot) => {
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
    await withGateRepo(adapterFiles(gateInput), async (repoRoot) => {
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
    await withGateRepo(files, async (repoRoot) => {
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
    await withGateRepo(adapterFiles(gateInput), async (repoRoot) => {
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
    first(gateInput.catalog).id = "activation-v2";
    await withGateRepo(adapterFiles(gateInput), async (repoRoot) => {
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
    first(gateInput.catalog).id = "activation-v2";
    first(gateInput.inventory.surfaceAuthorities).journeyId = "activation-v2";
    first(gateInput.inventory.receiptProducers).journeyId = "activation-v2";
    first(gateInput.inventory.receiptConsumers).journeyId = "activation-v2";
    const artifact = installClosedMigration(gateInput);
    await withGateRepo(adapterFiles(gateInput, artifact), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toEqual({ ok: true, diagnostics: [] });
    });
  });

  it("rejects a generic reusable migration approval artifact", async () => {
    const gateInput = input();
    first(gateInput.catalog).id = "activation-v2";
    first(gateInput.inventory.surfaceAuthorities).journeyId = "activation-v2";
    first(gateInput.inventory.receiptProducers).journeyId = "activation-v2";
    first(gateInput.inventory.receiptConsumers).journeyId = "activation-v2";
    installClosedMigration(gateInput);
    first(gateInput.migrationLedger).approval.artifactDigest =
      digest(approvalArtifact);
    await withGateRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "ADAPTER_INVALID",
            message: expect.stringContaining("closed migration approval"),
          },
        ],
      });
    });
  });

  it("rejects an approval artifact that does not exactly match its ledger migration", async () => {
    const gateInput = input();
    const artifact = installClosedMigration(gateInput);
    const mismatchedArtifact = {
      ...artifact,
      reason: "approve another migration",
    };
    first(gateInput.migrationLedger).approval.artifactDigest =
      digest(mismatchedArtifact);
    await withGateRepo(
      adapterFiles(gateInput, mismatchedArtifact),
      async (repoRoot) => {
        const result = await evaluateProductJourneyGate({
          repoRoot,
          adapterPath: "adapter.mjs",
        });
        expect(result).toMatchObject({
          ok: false,
          diagnostics: [
            {
              code: "ADAPTER_INVALID",
              message: expect.stringContaining("exactly bind migration"),
            },
          ],
        });
      },
    );
  });

  it("binds approved predecessor and successor hashes to the actual contracts", async () => {
    const gateInput = input();
    const artifact = installClosedMigration(gateInput);
    const migration = first(gateInput.migrationLedger);
    migration.predecessorContractHash = "forged-predecessor-hash";
    const forgedArtifact = {
      ...artifact,
      predecessorContractHash: migration.predecessorContractHash,
    };
    migration.approval.artifactDigest = digest(forgedArtifact);
    await withGateRepo(
      adapterFiles(gateInput, forgedArtifact),
      async (repoRoot) => {
        const result = await evaluateProductJourneyGate({
          repoRoot,
          adapterPath: "adapter.mjs",
        });
        expect(result).toMatchObject({
          ok: false,
          diagnostics: [
            {
              code: "ADAPTER_INVALID",
              message: expect.stringContaining("predecessor contract hash"),
            },
          ],
        });
      },
    );
  });

  it("rejects approved successor hashes that do not match the current contracts", async () => {
    const gateInput = input();
    const artifact = installClosedMigration(gateInput);
    const migration = first(gateInput.migrationLedger);
    migration.successorContractHashes = ["forged-successor-hash"];
    const forgedArtifact = {
      ...artifact,
      successorContractHashes: migration.successorContractHashes,
    };
    migration.approval.artifactDigest = digest(forgedArtifact);
    await withGateRepo(
      adapterFiles(gateInput, forgedArtifact),
      async (repoRoot) => {
        const result = await evaluateProductJourneyGate({
          repoRoot,
          adapterPath: "adapter.mjs",
        });
        expect(result).toMatchObject({
          ok: false,
          diagnostics: [
            {
              code: "ADAPTER_INVALID",
              message: expect.stringContaining("successor contract hashes"),
            },
          ],
        });
      },
    );
  });

  it("rejects retirement until attestation and lease continuity can be represented", async () => {
    const gateInput = input();
    const predecessor = first(gateInput.baselineCatalog);
    gateInput.migrationLedger = [
      {
        fromJourneyId: predecessor.id,
        toJourneyIds: [],
        baselineVersion: predecessor.version,
        predecessorContractHash: digest(predecessor),
        successorContractHashes: [],
        predecessorAttestationIdentity: "attestation:activation:1",
        successorAttestationIdentities: [],
        predecessorLeaseContinuityIdentity: "lease:activation:1",
        successorLeaseContinuityIdentities: [],
        approval: {
          artifactSource: "migration-approval.json",
          artifactDigest: digest(approvalArtifact),
          reviewerIdentity: "contract-owner",
        },
        reason: "retire journey",
      },
    ];
    await withGateRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "ADAPTER_INVALID",
            message: expect.stringContaining("retirement is unsupported"),
          },
        ],
      });
    });
  });

  it("rejects an unapproved journey-id migration ledger entry", async () => {
    const gateInput = input();
    const artifact = installClosedMigration(gateInput, {
      reviewerIdentity: "unprotected-reviewer",
      reason: "rename",
    });
    await withGateRepo(adapterFiles(gateInput, artifact), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "ADAPTER_INVALID",
            message: expect.stringContaining("approval identity contract"),
          },
        ],
      });
    });
  });

  it("rejects payloads that do not match their canonical named source digest", async () => {
    await withGateRepo(adapterFiles(input()), async (repoRoot) => {
      await writeFile(join(repoRoot, "catalog.json"), "[]");
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "ADAPTER_INVALID",
            message: expect.stringContaining("digest"),
          },
        ],
      });
    });
  });

  it("resolves merge-base identity independently of the adapter payload", async () => {
    await withGateRepo(adapterFiles(input()), async (repoRoot) => {
      const forged = input();
      first(forged.baselineCatalog).goal = "forged baseline";
      const forgedFiles = adapterFiles(forged);
      for (const [path, content] of Object.entries(forgedFiles)) {
        await writeFile(join(repoRoot, path), content);
      }
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "ADAPTER_INVALID",
            message: expect.stringContaining("merge-base identity"),
          },
        ],
      });
    });
  });

  it("preserves migration lifecycle, version, owner, and work-package continuity", async () => {
    const gateInput = input();
    Object.assign(first(gateInput.baselineCatalog), {
      id: "activation",
      version: 4,
      status: "admitted",
      owner: "original-owner@example.test",
      workPackageRefs: ["WP-1", "WP-2"],
    });
    Object.assign(first(gateInput.catalog), {
      id: "activation-v2",
      version: 1,
      status: "assembling",
      owner: "replacement@example.test",
      workPackageRefs: ["WP-1"],
    });
    first(gateInput.inventory.surfaceAuthorities).journeyId = "activation-v2";
    first(gateInput.inventory.receiptProducers).journeyId = "activation-v2";
    first(gateInput.inventory.receiptConsumers).journeyId = "activation-v2";
    const artifact = installClosedMigration(gateInput);
    await withGateRepo(adapterFiles(gateInput, artifact), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COVERAGE_REDUCED",
            journeyId: "activation",
            message: expect.stringContaining("continuity"),
          }),
        ]),
      );
    });
  });

  it("reports a malformed manifest from the repository adapter", async () => {
    await withGateRepo(
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
    await withGateRepo(adapterFiles(gateInput), async (repoRoot) => {
      const result = await evaluateProductJourneyGate({
        repoRoot,
        adapterPath: "adapter.mjs",
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "ENTRYPOINT_UNMAPPED",
            path: "unowned.ts",
          }),
        ]),
      });
    });
  });

  it("compares current contracts with the baseline", async () => {
    const gateInput = input();
    first(first(gateInput.catalog).scenarios).terminalOutcome = "weakened";
    await withGateRepo(adapterFiles(gateInput), async (repoRoot) => {
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
    await withGateRepo(adapterFiles(input()), async (fixtureRoot) => {
      const command = spawnSync(
        "pnpm",
        [
          "run",
          "check:product-journeys",
          "--",
          "--repo-root",
          fixtureRoot,
          "--adapter",
          join(fixtureRoot, "adapter.mjs"),
        ],
        { cwd: workspaceRoot, encoding: "utf8" },
      );
      expect(command.status, `${command.stdout}${command.stderr}`).toBe(0);
      expect(command.stdout).toContain("check:product-journeys: ok");
    });
  });

  it("makes the default command fail with a typed missing-adapter diagnostic", () => {
    const command = spawnSync("pnpm", ["run", "check:product-journeys"], {
      cwd: workspaceRoot,
      encoding: "utf8",
    });
    expect(command.status).toBe(1);
    expect(`${command.stdout}${command.stderr}`).toContain("ADAPTER_MISSING");
  });
});
