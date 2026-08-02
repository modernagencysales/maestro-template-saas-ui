import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
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
import {
  canonicalStringify,
  compareCodePoints,
} from "../../packages/product-journey/src/ordering.ts";
import { descriptorFor } from "./src/check-definitions.mts";
import { isDirectRun } from "./src/direct-run.mts";

export const descriptor = descriptorFor("product-journeys");
const execFileAsync = promisify(execFile);

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
  | "merge-base-contracts"
  | "protected-approval-identities";

export type ProductJourneyInputDescriptor = {
  readonly catalogSource: string;
  readonly inventorySource: string;
  readonly mergeBaseContractSource: string;
  readonly migrationLedgerSource: string;
  readonly approvalIdentitySource: string;
  readonly catalogDigest: string;
  readonly inventoryDigest: string;
  readonly mergeBaseContractDigest: string;
  readonly migrationLedgerDigest: string;
  readonly approvalIdentityDigest: string;
  readonly scanMechanisms: readonly ProductJourneyScanMechanism[];
};

export type ProductJourneyApprovalBinding = {
  readonly artifactSource: string;
  readonly artifactDigest: string;
  readonly reviewerIdentity: string;
};

export type ProductJourneyIdMigration = {
  readonly fromJourneyId: string;
  readonly toJourneyIds: readonly string[];
  readonly baselineVersion: number;
  readonly predecessorContractHash: string;
  readonly successorContractHashes: readonly string[];
  readonly predecessorAttestationIdentity: string;
  readonly successorAttestationIdentities: readonly string[];
  readonly predecessorLeaseContinuityIdentity: string;
  readonly successorLeaseContinuityIdentities: readonly string[];
  readonly approval: ProductJourneyApprovalBinding;
  readonly reason: string;
};

type ProductJourneyMigrationApprovalArtifact = {
  readonly approvalScope: "product-journey-id-migration";
  readonly decision: "approved";
  readonly reviewerIdentity: string;
  readonly fromJourneyId: string;
  readonly toJourneyIds: readonly string[];
  readonly baselineVersion: number;
  readonly predecessorContractHash: string;
  readonly successorContractHashes: readonly string[];
  readonly predecessorAttestationIdentity: string;
  readonly successorAttestationIdentities: readonly string[];
  readonly predecessorLeaseContinuityIdentity: string;
  readonly successorLeaseContinuityIdentities: readonly string[];
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
  "protected-approval-identities",
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
      "approvalIdentitySource",
      "catalogDigest",
      "inventoryDigest",
      "mergeBaseContractDigest",
      "migrationLedgerDigest",
      "approvalIdentityDigest",
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
    approvalIdentitySource: asString(
      descriptor.approvalIdentitySource,
      "adapter input.descriptor.approvalIdentitySource",
    ),
    catalogDigest: asString(
      descriptor.catalogDigest,
      "adapter input.descriptor.catalogDigest",
    ),
    inventoryDigest: asString(
      descriptor.inventoryDigest,
      "adapter input.descriptor.inventoryDigest",
    ),
    mergeBaseContractDigest: asString(
      descriptor.mergeBaseContractDigest,
      "adapter input.descriptor.mergeBaseContractDigest",
    ),
    migrationLedgerDigest: asString(
      descriptor.migrationLedgerDigest,
      "adapter input.descriptor.migrationLedgerDigest",
    ),
    approvalIdentityDigest: asString(
      descriptor.approvalIdentityDigest,
      "adapter input.descriptor.approvalIdentityDigest",
    ),
    scanMechanisms: scanMechanisms as readonly ProductJourneyScanMechanism[],
  };
};

const canonicalDigest = (value: unknown): string =>
  createHash("sha256").update(canonicalStringify(value)).digest("hex");

const resolveRepositoryPath = (repoRoot: string, source: string): string => {
  if (isAbsolute(source)) {
    throw new Error("descriptor sources must be repository-relative");
  }
  const fullPath = resolve(repoRoot, source);
  const pathFromRoot = relative(repoRoot, fullPath);
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
    throw new Error("descriptor sources must stay inside the repository");
  }
  return fullPath;
};

const readJsonSource = async (
  repoRoot: string,
  source: string,
): Promise<unknown> => {
  const content = await readFile(
    resolveRepositoryPath(repoRoot, source),
    "utf8",
  );
  if (content.trim().length === 0) {
    throw new Error(`descriptor source is empty: ${source}`);
  }
  return JSON.parse(content) as unknown;
};

const assertPayloadBinding = (
  label: string,
  sourceValue: unknown,
  payload: unknown,
  expectedDigest: string,
): void => {
  const sourceDigest = canonicalDigest(sourceValue);
  const payloadDigest = canonicalDigest(payload);
  if (sourceDigest !== expectedDigest || payloadDigest !== expectedDigest) {
    throw new Error(`${label} payload/source digest binding failed`);
  }
};

const resolveMergeBaseCatalog = async (
  repoRoot: string,
  source: string,
): Promise<unknown> => {
  try {
    const { stdout: identityOutput } = await execFileAsync(
      "git",
      ["merge-base", "HEAD", "origin/main"],
      { cwd: repoRoot },
    );
    const identity = identityOutput.trim();
    if (identity.length === 0) throw new Error("empty merge base");
    const { stdout } = await execFileAsync(
      "git",
      ["show", `${identity}:${source}`],
      { cwd: repoRoot },
    );
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error(
      "merge-base identity could not be independently resolved and bound",
    );
  }
};

const validateDescriptorBindings = async (
  repoRoot: string,
  descriptor: ProductJourneyInputDescriptor,
  payloads: {
    readonly catalog: unknown;
    readonly baselineCatalog: unknown;
    readonly inventory: unknown;
    readonly migrationLedger: unknown;
  },
): Promise<ReadonlySet<string>> => {
  const catalogSource = await readJsonSource(
    repoRoot,
    descriptor.catalogSource,
  );
  const inventorySource = await readJsonSource(
    repoRoot,
    descriptor.inventorySource,
  );
  const migrationSource = await readJsonSource(
    repoRoot,
    descriptor.migrationLedgerSource,
  );
  const approvalIdentitySource = await readJsonSource(
    repoRoot,
    descriptor.approvalIdentitySource,
  );
  assertPayloadBinding(
    "catalog",
    catalogSource,
    payloads.catalog,
    descriptor.catalogDigest,
  );
  assertPayloadBinding(
    "inventory",
    inventorySource,
    payloads.inventory,
    descriptor.inventoryDigest,
  );
  assertPayloadBinding(
    "migration ledger",
    migrationSource,
    payloads.migrationLedger,
    descriptor.migrationLedgerDigest,
  );
  if (
    canonicalDigest(approvalIdentitySource) !==
    descriptor.approvalIdentityDigest
  ) {
    throw new Error("approval identity source digest binding failed");
  }
  const mergeBaseCatalog = await resolveMergeBaseCatalog(
    repoRoot,
    descriptor.mergeBaseContractSource,
  );
  assertPayloadBinding(
    "merge-base identity",
    mergeBaseCatalog,
    payloads.baselineCatalog,
    descriptor.mergeBaseContractDigest,
  );
  const identityRecord = asRecord(
    approvalIdentitySource,
    "approval identity contract",
  );
  assertExactKeys(
    identityRecord,
    ["reviewerIdentities"],
    "approval identity contract",
  );
  return new Set(
    asStringArray(
      identityRecord.reviewerIdentities,
      "approval identity contract.reviewerIdentities",
    ),
  );
};

const parseReceiptEntries = (
  value: unknown,
  label: string,
): ReleaseSurfaceInventory["receiptProducers"] =>
  asArray(value, label).map((entry, index) => {
    const record = asRecord(entry, `${label}[${index}]`);
    assertExactKeys(
      record,
      ["journeyId", "from", "to", "receiptKind", "contractIdentity", "path"],
      `${label}[${index}]`,
    );
    return {
      journeyId: asString(record.journeyId, `${label}[${index}].journeyId`),
      from: asString(record.from, `${label}[${index}].from`),
      to: asString(record.to, `${label}[${index}].to`),
      receiptKind: asString(
        record.receiptKind,
        `${label}[${index}].receiptKind`,
      ),
      contractIdentity: asString(
        record.contractIdentity,
        `${label}[${index}].contractIdentity`,
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
        "predecessorContractHash",
        "successorContractHashes",
        "predecessorAttestationIdentity",
        "successorAttestationIdentities",
        "predecessorLeaseContinuityIdentity",
        "successorLeaseContinuityIdentities",
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
      throw new Error(
        `${label}: retirement is unsupported until continuity can be represented safely`,
      );
    }
    if (
      typeof record.baselineVersion !== "number" ||
      !Number.isSafeInteger(record.baselineVersion) ||
      record.baselineVersion < 1
    ) {
      throw new Error(`${label}.baselineVersion is invalid`);
    }
    const successorContractHashes = asStringArray(
      record.successorContractHashes,
      `${label}.successorContractHashes`,
    );
    const successorAttestationIdentities = asStringArray(
      record.successorAttestationIdentities,
      `${label}.successorAttestationIdentities`,
    );
    const successorLeaseContinuityIdentities = asStringArray(
      record.successorLeaseContinuityIdentities,
      `${label}.successorLeaseContinuityIdentities`,
    );
    if (
      successorContractHashes.length !== toJourneyIds.length ||
      successorAttestationIdentities.length !== toJourneyIds.length ||
      successorLeaseContinuityIdentities.length !== toJourneyIds.length
    ) {
      throw new Error(
        `${label} successor hashes, attestations, and lease identities must align exactly with toJourneyIds`,
      );
    }
    const approval = asRecord(record.approval, `${label}.approval`);
    assertExactKeys(
      approval,
      ["artifactSource", "artifactDigest", "reviewerIdentity"],
      `${label}.approval`,
    );
    return {
      fromJourneyId,
      toJourneyIds,
      baselineVersion: record.baselineVersion,
      predecessorContractHash: asString(
        record.predecessorContractHash,
        `${label}.predecessorContractHash`,
      ),
      successorContractHashes,
      predecessorAttestationIdentity: asString(
        record.predecessorAttestationIdentity,
        `${label}.predecessorAttestationIdentity`,
      ),
      successorAttestationIdentities,
      predecessorLeaseContinuityIdentity: asString(
        record.predecessorLeaseContinuityIdentity,
        `${label}.predecessorLeaseContinuityIdentity`,
      ),
      successorLeaseContinuityIdentities,
      approval: {
        artifactSource: asString(
          approval.artifactSource,
          `${label}.approval.artifactSource`,
        ),
        artifactDigest: asString(
          approval.artifactDigest,
          `${label}.approval.artifactDigest`,
        ),
        reviewerIdentity: asString(
          approval.reviewerIdentity,
          `${label}.approval.reviewerIdentity`,
        ),
      },
      reason: asString(record.reason, `${label}.reason`),
    };
  });
};

const parseMigrationApprovalArtifact = (
  value: unknown,
  label: string,
): ProductJourneyMigrationApprovalArtifact => {
  const artifact = asRecord(value, label);
  assertExactKeys(
    artifact,
    [
      "approvalScope",
      "decision",
      "reviewerIdentity",
      "fromJourneyId",
      "toJourneyIds",
      "baselineVersion",
      "predecessorContractHash",
      "successorContractHashes",
      "predecessorAttestationIdentity",
      "successorAttestationIdentities",
      "predecessorLeaseContinuityIdentity",
      "successorLeaseContinuityIdentities",
      "reason",
    ],
    label,
  );
  if (artifact.approvalScope !== "product-journey-id-migration") {
    throw new Error(`${label}.approvalScope is invalid`);
  }
  if (artifact.decision !== "approved") {
    throw new Error(`${label}.decision is invalid`);
  }
  if (
    typeof artifact.baselineVersion !== "number" ||
    !Number.isSafeInteger(artifact.baselineVersion) ||
    artifact.baselineVersion < 1
  ) {
    throw new Error(`${label}.baselineVersion is invalid`);
  }
  return {
    approvalScope: artifact.approvalScope,
    decision: artifact.decision,
    reviewerIdentity: asString(
      artifact.reviewerIdentity,
      `${label}.reviewerIdentity`,
    ),
    fromJourneyId: asString(artifact.fromJourneyId, `${label}.fromJourneyId`),
    toJourneyIds: asStringArray(artifact.toJourneyIds, `${label}.toJourneyIds`),
    baselineVersion: artifact.baselineVersion,
    predecessorContractHash: asString(
      artifact.predecessorContractHash,
      `${label}.predecessorContractHash`,
    ),
    successorContractHashes: asStringArray(
      artifact.successorContractHashes,
      `${label}.successorContractHashes`,
    ),
    predecessorAttestationIdentity: asString(
      artifact.predecessorAttestationIdentity,
      `${label}.predecessorAttestationIdentity`,
    ),
    successorAttestationIdentities: asStringArray(
      artifact.successorAttestationIdentities,
      `${label}.successorAttestationIdentities`,
    ),
    predecessorLeaseContinuityIdentity: asString(
      artifact.predecessorLeaseContinuityIdentity,
      `${label}.predecessorLeaseContinuityIdentity`,
    ),
    successorLeaseContinuityIdentities: asStringArray(
      artifact.successorLeaseContinuityIdentities,
      `${label}.successorLeaseContinuityIdentities`,
    ),
    reason: asString(artifact.reason, `${label}.reason`),
  };
};

const expectedMigrationApprovalArtifact = (
  migration: ProductJourneyIdMigration,
): ProductJourneyMigrationApprovalArtifact => ({
  approvalScope: "product-journey-id-migration",
  decision: "approved",
  reviewerIdentity: migration.approval.reviewerIdentity,
  fromJourneyId: migration.fromJourneyId,
  toJourneyIds: migration.toJourneyIds,
  baselineVersion: migration.baselineVersion,
  predecessorContractHash: migration.predecessorContractHash,
  successorContractHashes: migration.successorContractHashes,
  predecessorAttestationIdentity: migration.predecessorAttestationIdentity,
  successorAttestationIdentities: migration.successorAttestationIdentities,
  predecessorLeaseContinuityIdentity:
    migration.predecessorLeaseContinuityIdentity,
  successorLeaseContinuityIdentities:
    migration.successorLeaseContinuityIdentities,
  reason: migration.reason,
});

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

const continuityReductions = (
  prior: ProductJourneyManifest,
  proposed: ProductJourneyManifest,
): readonly string[] => {
  const reductions: string[] = [];
  if (proposed.version < prior.version) reductions.push("version regressed");
  if (proposed.status !== prior.status)
    reductions.push("lifecycle status changed");
  if (proposed.owner !== prior.owner) reductions.push("owner changed");
  for (const workPackage of prior.workPackageRefs) {
    if (!proposed.workPackageRefs.includes(workPackage)) {
      reductions.push(`work-package removed:${workPackage}`);
    }
  }
  for (const path of prior.affectedPaths) {
    if (!proposed.affectedPaths.includes(path)) {
      reductions.push(`affected-path removed:${path}`);
    }
  }
  return reductions.sort(compareCodePoints);
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
  let approvalIdentities: ReadonlySet<string>;
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
    catalogValues = asArray(inputRecord.catalog, "adapter input.catalog");
    baselineValues = asArray(
      inputRecord.baselineCatalog,
      "adapter input.baselineCatalog",
    );
    inventory = parseInventory(inputRecord.inventory);
    migrationLedger = parseMigrationLedger(inputRecord.migrationLedger);
    approvalIdentities = await validateDescriptorBindings(
      repoRoot,
      inputDescriptor,
      {
        catalog: catalogValues,
        baselineCatalog: baselineValues,
        inventory: inputRecord.inventory,
        migrationLedger: inputRecord.migrationLedger,
      },
    );
    for (const migration of migrationLedger) {
      if (!approvalIdentities.has(migration.approval.reviewerIdentity)) {
        throw new Error(
          `approval identity contract does not authorize ${migration.approval.reviewerIdentity}`,
        );
      }
      const artifact = await readJsonSource(
        repoRoot,
        migration.approval.artifactSource,
      );
      if (canonicalDigest(artifact) !== migration.approval.artifactDigest) {
        throw new Error(
          `approval artifact digest binding failed for ${migration.fromJourneyId}`,
        );
      }
      const parsedArtifact = parseMigrationApprovalArtifact(
        artifact,
        `closed migration approval artifact for ${migration.fromJourneyId}`,
      );
      if (
        canonicalDigest(parsedArtifact) !==
        canonicalDigest(expectedMigrationApprovalArtifact(migration))
      ) {
        throw new Error(
          `closed migration approval artifact does not exactly bind migration ${migration.fromJourneyId}`,
        );
      }
    }
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
    const successors = migration.toJourneyIds.map((journeyId) =>
      currentById.get(journeyId),
    );
    if (
      prior === undefined ||
      prior.version !== migration.baselineVersion ||
      successors.some((successor) => successor === undefined)
    ) {
      return failure(
        "ADAPTER_INVALID",
        `journey-id migration ledger entry is incompatible with catalog state: ${migration.fromJourneyId}`,
        adapterPath,
      );
    }
    if (canonicalDigest(prior) !== migration.predecessorContractHash) {
      return failure(
        "ADAPTER_INVALID",
        `migration predecessor contract hash does not match baseline: ${migration.fromJourneyId}`,
        adapterPath,
      );
    }
    const actualSuccessorHashes = successors.map((successor) =>
      canonicalDigest(successor),
    );
    if (
      canonicalDigest(actualSuccessorHashes) !==
      canonicalDigest(migration.successorContractHashes)
    ) {
      return failure(
        "ADAPTER_INVALID",
        `migration successor contract hashes do not match current catalog: ${migration.fromJourneyId}`,
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
          const target = currentById.get(targetId);
          if (target === undefined) {
            return failure(
              "ADAPTER_INVALID",
              `journey-id migration target is missing from catalog: ${targetId}`,
              adapterPath,
            );
          }
          const continuity = continuityReductions(prior, target);
          if (continuity.length > 0) {
            diagnostics.push({
              code: "COVERAGE_REDUCED",
              journeyId: prior.id,
              path: targetId,
              message: `journey migration continuity reduced: ${continuity.join(", ")}`,
            });
          }
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
    const continuity = continuityReductions(prior, proposed);
    if (continuity.length > 0) {
      diagnostics.push({
        code: "COVERAGE_REDUCED",
        journeyId: prior.id,
        message: `journey contract continuity reduced: ${continuity.join(", ")}`,
      });
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
