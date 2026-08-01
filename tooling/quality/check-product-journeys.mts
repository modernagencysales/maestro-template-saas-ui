import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { diffJourneyContract } from "../../packages/product-journey/src/contract-diff.ts";
import {
  validateJourneyCatalog,
  type JourneyDiagnostic,
  type ReleaseSurfaceAuthority,
  type ReleaseSurfaceInventory,
} from "../../packages/product-journey/src/graph.ts";
import {
  parseProductJourneyManifest,
  type ProductJourneyManifest,
} from "../../packages/product-journey/src/manifest.ts";
import { compareCodePoints } from "../../packages/product-journey/src/ordering.ts";
import { descriptorFor } from "./src/check-definitions.mts";
import { isDirectRun } from "./src/direct-run.mts";

export const descriptor = descriptorFor("product-journeys");

export type ProductJourneyGateDiagnostic = Omit<JourneyDiagnostic, "code"> & {
  readonly code:
    | JourneyDiagnostic["code"]
    | "ADAPTER_MISSING"
    | "ADAPTER_UNREADABLE"
    | "ADAPTER_INVALID"
    | "MANIFEST_INVALID";
};

export type ProductJourneyGateResult = {
  readonly ok: boolean;
  readonly diagnostics: readonly ProductJourneyGateDiagnostic[];
};

export type ProductJourneyGateInput = {
  readonly descriptor: ProductJourneyInputDescriptor;
  readonly catalog: readonly unknown[];
  readonly baselineCatalog: readonly unknown[];
  readonly inventory: unknown;
  readonly migrationLedger: readonly unknown[];
};

export type ProductJourneyScanMechanism =
  | "catalog-module"
  | "generated-inventory"
  | "journey-id-migrations"
  | "merge-base-contracts";

export type ProductJourneyInputDescriptor = {
  readonly catalogSource: string;
  readonly inventorySource: string;
  readonly mergeBaseContractSource: string;
  readonly migrationLedgerSource: string;
  readonly scanMechanisms: readonly ProductJourneyScanMechanism[];
};

export type ProductJourneyIdMigration = {
  readonly fromJourneyId: string;
  readonly toJourneyIds: readonly string[];
  readonly baselineVersion: number;
  readonly approval: string;
  readonly reason: string;
};

export type ProductJourneyRepositoryAdapter = {
  readonly loadProductJourneyInputs: () =>
    ProductJourneyGateInput | Promise<ProductJourneyGateInput>;
};

const compareDiagnostics = (
  left: ProductJourneyGateDiagnostic,
  right: ProductJourneyGateDiagnostic,
): number =>
  compareCodePoints(left.code, right.code) ||
  compareCodePoints(left.journeyId, right.journeyId) ||
  compareCodePoints(left.path ?? "", right.path ?? "") ||
  compareCodePoints(left.message, right.message);

const failure = (
  code: ProductJourneyGateDiagnostic["code"],
  message: string,
  path?: string,
): ProductJourneyGateResult => ({
  ok: false,
  diagnostics: [
    {
      code,
      journeyId: "catalog",
      ...(path === undefined ? {} : { path }),
      message,
    },
  ],
});

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const asArray = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
};

const asString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

const asStringArray = (value: unknown, label: string): readonly string[] =>
  asArray(value, label).map((entry, index) =>
    asString(entry, `${label}[${index}]`),
  );

const assertExactKeys = (
  record: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void => {
  const actual = Object.keys(record).sort(compareCodePoints);
  const canonicalExpected = [...expected].sort(compareCodePoints);
  if (
    actual.length !== canonicalExpected.length ||
    actual.some((key, index) => key !== canonicalExpected[index])
  ) {
    throw new Error(`${label} contains missing or unknown fields`);
  }
};

const requiredScanMechanisms = [
  "catalog-module",
  "generated-inventory",
  "journey-id-migrations",
  "merge-base-contracts",
] as const satisfies readonly ProductJourneyScanMechanism[];

const parseInputDescriptor = (
  value: unknown,
): ProductJourneyInputDescriptor => {
  const descriptor = asRecord(value, "adapter input.descriptor");
  assertExactKeys(
    descriptor,
    [
      "catalogSource",
      "inventorySource",
      "mergeBaseContractSource",
      "migrationLedgerSource",
      "scanMechanisms",
    ],
    "adapter input.descriptor",
  );
  const scanMechanisms = [
    ...asStringArray(
      descriptor.scanMechanisms,
      "adapter input.descriptor.scanMechanisms",
    ),
  ].sort(compareCodePoints);
  const expectedMechanisms = [...requiredScanMechanisms].sort(
    compareCodePoints,
  );
  if (
    scanMechanisms.length !== expectedMechanisms.length ||
    scanMechanisms.some(
      (mechanism, index) => mechanism !== expectedMechanisms[index],
    )
  ) {
    throw new Error(
      "adapter input.descriptor.scanMechanisms must name every supported scan mechanism exactly once",
    );
  }
  return {
    catalogSource: asString(
      descriptor.catalogSource,
      "adapter input.descriptor.catalogSource",
    ),
    inventorySource: asString(
      descriptor.inventorySource,
      "adapter input.descriptor.inventorySource",
    ),
    mergeBaseContractSource: asString(
      descriptor.mergeBaseContractSource,
      "adapter input.descriptor.mergeBaseContractSource",
    ),
    migrationLedgerSource: asString(
      descriptor.migrationLedgerSource,
      "adapter input.descriptor.migrationLedgerSource",
    ),
    scanMechanisms: scanMechanisms as readonly ProductJourneyScanMechanism[],
  };
};

const validateDescriptorSources = async (
  repoRoot: string,
  descriptor: ProductJourneyInputDescriptor,
): Promise<void> => {
  for (const source of [
    descriptor.catalogSource,
    descriptor.inventorySource,
    descriptor.mergeBaseContractSource,
    descriptor.migrationLedgerSource,
  ]) {
    if (isAbsolute(source)) {
      throw new Error("descriptor sources must be repository-relative");
    }
    const fullPath = resolve(repoRoot, source);
    const pathFromRoot = relative(repoRoot, fullPath);
    if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
      throw new Error("descriptor sources must stay inside the repository");
    }
    const content = await readFile(fullPath, "utf8");
    if (content.trim().length === 0) {
      throw new Error(`descriptor source is empty: ${source}`);
    }
  }
};

const parseReceiptEntries = (
  value: unknown,
  label: string,
): readonly { readonly receiptKind: string; readonly path: string }[] =>
  asArray(value, label).map((entry, index) => {
    const record = asRecord(entry, `${label}[${index}]`);
    return {
      receiptKind: asString(
        record.receiptKind,
        `${label}[${index}].receiptKind`,
      ),
      path: asString(record.path, `${label}[${index}].path`),
    };
  });

const parseSurfaceAuthorities = (
  value: unknown,
): readonly ReleaseSurfaceAuthority[] =>
  asArray(value, "inventory.surfaceAuthorities").map((entry, index) => {
    const label = `inventory.surfaceAuthorities[${index}]`;
    const record = asRecord(entry, label);
    assertExactKeys(
      record,
      ["path", "journeyId", "authority", "transport"],
      label,
    );
    const authority = asString(record.authority, `${label}.authority`);
    const transport = asString(record.transport, `${label}.transport`);
    if (
      authority !== "read" &&
      authority !== "write" &&
      authority !== "external_dispatch" &&
      authority !== "async"
    ) {
      throw new Error(`${label}.authority is unknown`);
    }
    if (transport !== "local" && transport !== "non_local") {
      throw new Error(`${label}.transport is unknown`);
    }
    return {
      path: asString(record.path, `${label}.path`),
      journeyId: asString(record.journeyId, `${label}.journeyId`),
      authority,
      transport,
    };
  });

const parseMigrationLedger = (
  value: unknown,
): readonly ProductJourneyIdMigration[] => {
  const seen = new Set<string>();
  return asArray(value, "adapter input.migrationLedger").map((entry, index) => {
    const label = `migrationLedger[${index}]`;
    const record = asRecord(entry, label);
    assertExactKeys(
      record,
      [
        "fromJourneyId",
        "toJourneyIds",
        "baselineVersion",
        "approval",
        "reason",
      ],
      label,
    );
    const fromJourneyId = asString(
      record.fromJourneyId,
      `${label}.fromJourneyId`,
    );
    if (seen.has(fromJourneyId)) {
      throw new Error(
        `migrationLedger contains duplicate source ${fromJourneyId}`,
      );
    }
    seen.add(fromJourneyId);
    const toJourneyIds = asStringArray(
      record.toJourneyIds,
      `${label}.toJourneyIds`,
    );
    if (toJourneyIds.length === 0) {
      throw new Error(`${label}.toJourneyIds must not be empty`);
    }
    if (
      typeof record.baselineVersion !== "number" ||
      !Number.isSafeInteger(record.baselineVersion) ||
      record.baselineVersion < 1
    ) {
      throw new Error(`${label}.baselineVersion is invalid`);
    }
    return {
      fromJourneyId,
      toJourneyIds,
      baselineVersion: record.baselineVersion,
      approval: asString(record.approval, `${label}.approval`),
      reason: asString(record.reason, `${label}.reason`),
    };
  });
};

const parseInventory = (value: unknown): ReleaseSurfaceInventory => {
  const inventory = asRecord(value, "inventory");
  const frontiers = asArray(inventory.frontiers, "inventory.frontiers").map(
    (entry, index) => {
      const record = asRecord(entry, `inventory.frontiers[${index}]`);
      const previousReachedNode = record.previousReachedNode;
      return {
        journeyId: asString(
          record.journeyId,
          `inventory.frontiers[${index}].journeyId`,
        ),
        reachedNode: asString(
          record.reachedNode,
          `inventory.frontiers[${index}].reachedNode`,
        ),
        ...(previousReachedNode === undefined
          ? {}
          : {
              previousReachedNode: asString(
                previousReachedNode,
                `inventory.frontiers[${index}].previousReachedNode`,
              ),
            }),
      };
    },
  );
  return {
    releaseEntrypoints: asStringArray(
      inventory.releaseEntrypoints,
      "inventory.releaseEntrypoints",
    ),
    receiptProducers: parseReceiptEntries(
      inventory.receiptProducers,
      "inventory.receiptProducers",
    ),
    receiptConsumers: parseReceiptEntries(
      inventory.receiptConsumers,
      "inventory.receiptConsumers",
    ),
    frontiers,
    legacyEntrypoints: asStringArray(
      inventory.legacyEntrypoints,
      "inventory.legacyEntrypoints",
    ),
    classifiedPaths: asStringArray(
      inventory.classifiedPaths,
      "inventory.classifiedPaths",
    ),
    surfaceAuthorities: parseSurfaceAuthorities(inventory.surfaceAuthorities),
    today: asString(inventory.today, "inventory.today"),
  };
};

const parseCatalog = (
  values: readonly unknown[],
  label: string,
):
  | { readonly manifests: readonly ProductJourneyManifest[] }
  | { readonly diagnostic: ProductJourneyGateDiagnostic } => {
  const manifests: ProductJourneyManifest[] = [];
  for (const [index, value] of values.entries()) {
    try {
      manifests.push(parseProductJourneyManifest(value));
    } catch (error) {
      return {
        diagnostic: {
          code: "MANIFEST_INVALID",
          journeyId: "catalog",
          path: `${label}[${index}]`,
          message: `${label} contains an invalid journey manifest: ${error instanceof Error ? error.message : "unknown parse failure"}`,
        },
      };
    }
  }
  return { manifests };
};

const loadAdapterInput = async (
  repoRoot: string,
  adapterPath: string,
): Promise<ProductJourneyGateInput> => {
  const fullPath = isAbsolute(adapterPath)
    ? adapterPath
    : resolve(repoRoot, adapterPath);
  await access(fullPath);
  const loaded = (await import(
    `${pathToFileURL(fullPath).href}?productJourneyGate=${Date.now()}`
  )) as Partial<ProductJourneyRepositoryAdapter>;
  if (typeof loaded.loadProductJourneyInputs !== "function") {
    throw new TypeError("adapter must export loadProductJourneyInputs()");
  }
  return loaded.loadProductJourneyInputs();
};

export const evaluateProductJourneyGate = async ({
  repoRoot,
  adapterPath,
}: {
  readonly repoRoot: string;
  readonly adapterPath?: string;
}): Promise<ProductJourneyGateResult> => {
  if (adapterPath === undefined || adapterPath.length === 0) {
    return failure(
      "ADAPTER_MISSING",
      "repository product-journey adapter is required; rerun with --adapter <module>",
    );
  }

  let input: ProductJourneyGateInput;
  try {
    input = await loadAdapterInput(repoRoot, adapterPath);
  } catch {
    return failure(
      "ADAPTER_UNREADABLE",
      "repository product-journey adapter could not be loaded",
      adapterPath,
    );
  }

  let inputRecord: Record<string, unknown>;
  let catalogValues: readonly unknown[];
  let baselineValues: readonly unknown[];
  let inventory: ReleaseSurfaceInventory;
  let migrationLedger: readonly ProductJourneyIdMigration[];
  try {
    inputRecord = asRecord(input, "adapter input");
    assertExactKeys(
      inputRecord,
      [
        "descriptor",
        "catalog",
        "baselineCatalog",
        "inventory",
        "migrationLedger",
      ],
      "adapter input",
    );
    const inputDescriptor = parseInputDescriptor(inputRecord.descriptor);
    await validateDescriptorSources(repoRoot, inputDescriptor);
    catalogValues = asArray(inputRecord.catalog, "adapter input.catalog");
    baselineValues = asArray(
      inputRecord.baselineCatalog,
      "adapter input.baselineCatalog",
    );
    inventory = parseInventory(inputRecord.inventory);
    migrationLedger = parseMigrationLedger(inputRecord.migrationLedger);
    if (catalogValues.length === 0 || baselineValues.length === 0) {
      throw new Error("catalog and baselineCatalog must not be empty");
    }
    if (
      inventory.releaseEntrypoints.length === 0 ||
      inventory.classifiedPaths?.length === 0 ||
      inventory.surfaceAuthorities?.length === 0
    ) {
      throw new Error(
        "generated inventory releaseEntrypoints, classifiedPaths, and surfaceAuthorities must not be empty",
      );
    }
  } catch (error) {
    return failure(
      "ADAPTER_INVALID",
      `repository product-journey adapter returned invalid input: ${error instanceof Error ? error.message : "unknown validation failure"}`,
      adapterPath,
    );
  }

  const current = parseCatalog(catalogValues, "catalog");
  if ("diagnostic" in current) {
    return { ok: false, diagnostics: [current.diagnostic] };
  }
  const baseline = parseCatalog(baselineValues, "baselineCatalog");
  if ("diagnostic" in baseline) {
    return { ok: false, diagnostics: [baseline.diagnostic] };
  }

  const diagnostics: ProductJourneyGateDiagnostic[] = [
    ...validateJourneyCatalog(current.manifests, inventory),
  ];
  const currentById = new Map(
    current.manifests.map((manifest) => [manifest.id, manifest]),
  );
  const baselineById = new Map(
    baseline.manifests.map((manifest) => [manifest.id, manifest]),
  );
  for (const migration of migrationLedger) {
    const prior = baselineById.get(migration.fromJourneyId);
    if (
      prior === undefined ||
      prior.version !== migration.baselineVersion ||
      migration.toJourneyIds.some((journeyId) => !currentById.has(journeyId))
    ) {
      return failure(
        "ADAPTER_INVALID",
        `journey-id migration ledger entry is incompatible with catalog state: ${migration.fromJourneyId}`,
        adapterPath,
      );
    }
  }
  for (const prior of baseline.manifests) {
    const proposed = currentById.get(prior.id);
    if (proposed === undefined) {
      const migration = migrationLedger.find(
        ({ fromJourneyId }) => fromJourneyId === prior.id,
      );
      if (migration === undefined) {
        diagnostics.push({
          code: "COVERAGE_REDUCED",
          journeyId: prior.id,
          message:
            "journey contract was removed or renamed without a protected migration ledger entry",
        });
      } else {
        for (const targetId of migration.toJourneyIds) {
          const target = currentById.get(targetId)!;
          const migratedDiff = diffJourneyContract(prior, target);
          if (migratedDiff.requiresApproval) {
            diagnostics.push({
              code: "COVERAGE_REDUCED",
              journeyId: prior.id,
              path: targetId,
              message: `migrated journey contract changed relative to baseline: ${migratedDiff.reductions.join(", ")}`,
            });
          }
        }
      }
      continue;
    }
    const contractDiff = diffJourneyContract(prior, proposed);
    if (contractDiff.requiresApproval) {
      diagnostics.push({
        code: "COVERAGE_REDUCED",
        journeyId: prior.id,
        message: `journey contract changed relative to baseline: ${contractDiff.reductions.join(", ")}`,
      });
    }
  }
  diagnostics.sort(compareDiagnostics);
  return { ok: diagnostics.length === 0, diagnostics };
};

const optionValue = (
  argv: readonly string[],
  option: string,
): string | undefined => {
  const index = argv.indexOf(option);
  return index === -1 ? undefined : argv[index + 1];
};

export const runProductJourneyGate = async (
  argv: readonly string[],
  repoRoot?: string,
): Promise<ProductJourneyGateResult> => {
  const effectiveRepoRoot =
    repoRoot ?? optionValue(argv, "--repo-root") ?? process.cwd();
  const result = await evaluateProductJourneyGate({
    repoRoot: effectiveRepoRoot,
    adapterPath: optionValue(argv, "--adapter"),
  });
  if (result.ok) console.log("check:product-journeys: ok");
  else {
    for (const diagnostic of result.diagnostics) {
      console.error(`${diagnostic.code}: ${diagnostic.message}`);
    }
    process.exitCode = 1;
  }
  return result;
};

if (isDirectRun(import.meta.url)) {
  await runProductJourneyGate(process.argv.slice(2));
}
