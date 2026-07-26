import { createHash, verify } from "node:crypto";
import type {
  MigrationCounts,
  MigrationPlanInputV1,
  MigrationPlanResult,
  MigrationReceiptV1,
  MigrationRecoveryV1,
  MigrationResolution,
  MigrationVersionRelation,
} from "./contract.js";

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const onlyKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => Object.keys(value).every((key) => keys.includes(key));
const text = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value === value.trim() &&
  value === value.normalize("NFC");
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown): value is string =>
  text(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const readCounts = (value: unknown): MigrationCounts | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, ["scanned", "eligible", "alreadyCompatible"]) ||
    !count(value.scanned) ||
    !count(value.eligible) ||
    !count(value.alreadyCompatible)
  ) {
    return undefined;
  }
  return {
    scanned: value.scanned,
    eligible: value.eligible,
    alreadyCompatible: value.alreadyCompatible,
  };
};

const readRecovery = (value: unknown): MigrationRecoveryV1 | undefined => {
  if (!isRecord(value) || !text(value.kind) || !text(value.operatorCommand))
    return undefined;
  if (value.kind === "rollback") {
    if (
      !onlyKeys(value, ["kind", "operatorCommand", "evidenceRequirement"]) ||
      !text(value.evidenceRequirement)
    )
      return undefined;
    return {
      kind: "rollback",
      operatorCommand: value.operatorCommand,
      evidenceRequirement: value.evidenceRequirement,
    };
  }
  if (
    value.kind !== "roll-forward-only" ||
    !onlyKeys(value, [
      "kind",
      "reason",
      "operatorCommand",
      "approvalEvidenceRef",
      "backupOrExportEvidenceRef",
      "rollForwardPlan",
    ]) ||
    !text(value.reason) ||
    (value.approvalEvidenceRef !== undefined &&
      !text(value.approvalEvidenceRef)) ||
    (value.backupOrExportEvidenceRef !== undefined &&
      !text(value.backupOrExportEvidenceRef)) ||
    (value.rollForwardPlan !== undefined && !text(value.rollForwardPlan))
  ) {
    return undefined;
  }
  return {
    kind: "roll-forward-only",
    reason: value.reason,
    operatorCommand: value.operatorCommand,
    ...(value.approvalEvidenceRef
      ? { approvalEvidenceRef: value.approvalEvidenceRef }
      : {}),
    ...(value.backupOrExportEvidenceRef
      ? { backupOrExportEvidenceRef: value.backupOrExportEvidenceRef }
      : {}),
    ...(value.rollForwardPlan
      ? { rollForwardPlan: value.rollForwardPlan }
      : {}),
  };
};

const readReceipt = (value: unknown): MigrationReceiptV1 | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "schemaVersion",
      "id",
      "transitionId",
      "migrationId",
      "migrationFingerprint",
      "releaseRootCommit",
      "releaseManifestHash",
      "migrationManifestHash",
      "fileUpgradePlanFingerprint",
      "status",
      "completedAt",
      "issuer",
      "replayIdentity",
      "authorization",
      "previewCounts",
      "migrateCounts",
      "evidence",
      "signature",
    ]) ||
    value.schemaVersion !== 1 ||
    !text(value.id) ||
    !text(value.transitionId) ||
    !text(value.migrationId) ||
    !digest(value.migrationFingerprint) ||
    typeof value.releaseRootCommit !== "string" ||
    !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(value.releaseRootCommit) ||
    !digest(value.releaseManifestHash) ||
    !digest(value.migrationManifestHash) ||
    !digest(value.fileUpgradePlanFingerprint) ||
    value.status !== "completed" ||
    !timestamp(value.completedAt) ||
    !isRecord(value.issuer) ||
    !onlyKeys(value.issuer, ["id", "keyId"]) ||
    !text(value.issuer.id) ||
    !text(value.issuer.keyId) ||
    !text(value.replayIdentity) ||
    !isRecord(value.authorization) ||
    !onlyKeys(value.authorization, ["approved", "evidenceRef"]) ||
    typeof value.authorization.approved !== "boolean" ||
    !text(value.authorization.evidenceRef) ||
    !isRecord(value.migrateCounts) ||
    !onlyKeys(value.migrateCounts, ["attempted", "succeeded", "failed"]) ||
    !count(value.migrateCounts.attempted) ||
    !count(value.migrateCounts.succeeded) ||
    !count(value.migrateCounts.failed) ||
    !Array.isArray(value.evidence) ||
    !isRecord(value.signature) ||
    !onlyKeys(value.signature, ["algorithm", "value"]) ||
    value.signature.algorithm !== "ed25519" ||
    !text(value.signature.value)
  ) {
    return undefined;
  }
  const previewCounts = readCounts(value.previewCounts);
  const evidence = value.evidence.map((entry) => {
    if (
      !isRecord(entry) ||
      !onlyKeys(entry, ["id", "evidenceRef"]) ||
      !text(entry.id) ||
      !text(entry.evidenceRef)
    )
      return undefined;
    return { id: entry.id, evidenceRef: entry.evidenceRef };
  });
  if (
    !previewCounts ||
    evidence.some((entry) => entry === undefined) ||
    new Set(evidence.map((entry) => entry?.id)).size !== evidence.length
  )
    return undefined;
  return {
    schemaVersion: 1,
    id: value.id,
    transitionId: value.transitionId,
    migrationId: value.migrationId,
    migrationFingerprint: value.migrationFingerprint,
    releaseRootCommit: value.releaseRootCommit,
    releaseManifestHash: value.releaseManifestHash,
    migrationManifestHash: value.migrationManifestHash,
    fileUpgradePlanFingerprint: value.fileUpgradePlanFingerprint,
    status: "completed",
    completedAt: value.completedAt,
    issuer: { id: value.issuer.id, keyId: value.issuer.keyId },
    replayIdentity: value.replayIdentity,
    authorization: {
      approved: value.authorization.approved,
      evidenceRef: value.authorization.evidenceRef,
    },
    previewCounts,
    migrateCounts: {
      attempted: value.migrateCounts.attempted,
      succeeded: value.migrateCounts.succeeded,
      failed: value.migrateCounts.failed,
    },
    evidence: evidence as MigrationReceiptV1["evidence"],
    signature: { algorithm: "ed25519", value: value.signature.value },
  };
};

const parseInput = (value: unknown): MigrationPlanInputV1 | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "schemaVersion",
      "transition",
      "target",
      "phases",
      "migration",
      "receipt",
    ]) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.transition) ||
    !onlyKeys(value.transition, [
      "id",
      "fromVersion",
      "toVersion",
      "immediatePriorVersion",
    ]) ||
    !text(value.transition.id) ||
    !text(value.transition.fromVersion) ||
    !text(value.transition.toVersion) ||
    !text(value.transition.immediatePriorVersion) ||
    value.transition.fromVersion === value.transition.toVersion ||
    !isRecord(value.target) ||
    !onlyKeys(value.target, ["version", "relation"]) ||
    !text(value.target.version) ||
    !["immediate-prior", "unknown", "older", "skipped", "newer"].includes(
      String(value.target.relation),
    ) ||
    !Array.isArray(value.phases) ||
    value.phases.length !== 2 ||
    !isRecord(value.migration) ||
    !onlyKeys(value.migration, [
      "id",
      "irreversible",
      "operatorCommand",
      "previewCounts",
      "migrateCounts",
      "compatibilityWindow",
      "evidenceRequirements",
      "recovery",
    ]) ||
    !text(value.migration.id) ||
    typeof value.migration.irreversible !== "boolean" ||
    !text(value.migration.operatorCommand) ||
    !isRecord(value.migration.migrateCounts) ||
    !onlyKeys(value.migration.migrateCounts, ["planned"]) ||
    !count(value.migration.migrateCounts.planned) ||
    !isRecord(value.migration.compatibilityWindow) ||
    !onlyKeys(value.migration.compatibilityWindow, [
      "startsAt",
      "endsAt",
      "contractNotBefore",
    ]) ||
    !timestamp(value.migration.compatibilityWindow.startsAt) ||
    !timestamp(value.migration.compatibilityWindow.endsAt) ||
    !timestamp(value.migration.compatibilityWindow.contractNotBefore) ||
    !Array.isArray(value.migration.evidenceRequirements)
  ) {
    return undefined;
  }
  const phases = value.phases.map((phase) => {
    if (
      !isRecord(phase) ||
      !onlyKeys(phase, ["kind", "evidenceRef"]) ||
      !["expand", "backward-compatible-code"].includes(String(phase.kind)) ||
      !text(phase.evidenceRef)
    )
      return undefined;
    return { kind: phase.kind, evidenceRef: phase.evidenceRef };
  });
  const previewCounts = readCounts(value.migration.previewCounts);
  const recovery = readRecovery(value.migration.recovery);
  const evidenceRequirements = value.migration.evidenceRequirements.map(
    (requirement) => {
      if (
        !isRecord(requirement) ||
        !onlyKeys(requirement, ["id", "detail"]) ||
        !text(requirement.id) ||
        !text(requirement.detail)
      )
        return undefined;
      return { id: requirement.id, detail: requirement.detail };
    },
  );
  const receipt =
    value.receipt === undefined ? undefined : readReceipt(value.receipt);
  if (
    phases.some((phase) => phase === undefined) ||
    !previewCounts ||
    !recovery ||
    evidenceRequirements.some((requirement) => requirement === undefined) ||
    new Set(evidenceRequirements.map((requirement) => requirement?.id)).size !==
      evidenceRequirements.length ||
    (value.receipt !== undefined && !receipt)
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    transition: {
      id: value.transition.id,
      fromVersion: value.transition.fromVersion,
      toVersion: value.transition.toVersion,
      immediatePriorVersion: value.transition.immediatePriorVersion,
    },
    target: {
      version: value.target.version,
      relation: value.target.relation as MigrationVersionRelation,
    },
    phases: [
      phases[0] as MigrationPlanInputV1["phases"][0],
      phases[1] as MigrationPlanInputV1["phases"][1],
    ],
    migration: {
      id: value.migration.id,
      irreversible: value.migration.irreversible,
      operatorCommand: value.migration.operatorCommand,
      previewCounts,
      migrateCounts: { planned: value.migration.migrateCounts.planned },
      compatibilityWindow: {
        startsAt: value.migration.compatibilityWindow.startsAt,
        endsAt: value.migration.compatibilityWindow.endsAt,
        contractNotBefore:
          value.migration.compatibilityWindow.contractNotBefore,
      },
      evidenceRequirements:
        evidenceRequirements as MigrationPlanInputV1["migration"]["evidenceRequirements"],
      recovery,
    },
    ...(receipt ? { receipt } : {}),
  };
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
};
export const migrationReceiptSigningPayload = (
  receipt: Omit<MigrationReceiptV1, "signature">,
): Buffer => Buffer.from(JSON.stringify(canonicalize(receipt)));
export const verifyMigrationReceiptSignatureEphemeralUntrusted = (
  receipt: MigrationReceiptV1,
  publicKeyPem: string,
): {
  readonly cryptographicallyValid: boolean;
  readonly trusted: false;
  readonly replaySafe: false;
} => {
  const { signature, ...unsignedReceipt } = receipt;
  let cryptographicallyValid = false;
  try {
    cryptographicallyValid = verify(
      null,
      migrationReceiptSigningPayload(unsignedReceipt),
      publicKeyPem,
      Buffer.from(signature.value, "base64"),
    );
  } catch {
    cryptographicallyValid = false;
  }
  return { cryptographicallyValid, trusted: false, replaySafe: false };
};
const fingerprint = (value: unknown): string =>
  `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
const resolution = (
  code: MigrationResolution["code"],
  message: string,
  repair: string,
): MigrationResolution => ({ code, message, repair });

const semanticResolutions = (
  input: MigrationPlanInputV1,
): readonly MigrationResolution[] => {
  const resolutions: MigrationResolution[] = [];
  const relationCodes = {
    unknown: "MIGRATION_SOURCE_UNKNOWN",
    older: "MIGRATION_SOURCE_OLDER",
    skipped: "MIGRATION_SOURCE_SKIPPED",
    newer: "MIGRATION_SOURCE_NEWER",
  } as const;
  if (input.target.relation !== "immediate-prior") {
    resolutions.push(
      resolution(
        relationCodes[input.target.relation],
        `Source relation ${input.target.relation} is unsupported.`,
        `Move through a separately reviewed transition to ${input.transition.fromVersion}.`,
      ),
    );
  } else if (
    input.target.version !== input.transition.fromVersion ||
    input.transition.immediatePriorVersion !== input.transition.fromVersion
  ) {
    resolutions.push(
      resolution(
        "MIGRATION_SOURCE_MISMATCH",
        "Source is not the exact reviewed immediate-prior version.",
        "Regenerate the handoff from the canonical compatibility authority.",
      ),
    );
  }
  if (
    input.phases[0].kind !== "expand" ||
    input.phases[1].kind !== "backward-compatible-code"
  ) {
    resolutions.push(
      resolution(
        "MIGRATION_PHASE_ORDER_INVALID",
        "Expand and backward-compatible code must precede migration.",
        "Verify expand first, then deploy backward-compatible code.",
      ),
    );
  }
  const { previewCounts, migrateCounts, compatibilityWindow, recovery } =
    input.migration;
  if (
    previewCounts.eligible + previewCounts.alreadyCompatible >
      previewCounts.scanned ||
    migrateCounts.planned !== previewCounts.eligible
  ) {
    resolutions.push(
      resolution(
        "MIGRATION_COUNTS_INVALID",
        "Preview and planned migration counts are inconsistent.",
        "Regenerate redacted counts without exposing record values.",
      ),
    );
  }
  if (
    compatibilityWindow.startsAt >= compatibilityWindow.endsAt ||
    compatibilityWindow.contractNotBefore < compatibilityWindow.endsAt
  ) {
    resolutions.push(
      resolution(
        "MIGRATION_COMPATIBILITY_WINDOW_INVALID",
        "Contract is not held until the compatibility window closes.",
        "Move contractNotBefore to or after the window end.",
      ),
    );
  }
  if (
    input.migration.irreversible &&
    (recovery.kind !== "roll-forward-only" ||
      !recovery.approvalEvidenceRef ||
      !recovery.backupOrExportEvidenceRef ||
      !recovery.rollForwardPlan)
  ) {
    resolutions.push(
      resolution(
        "MIGRATION_IRREVERSIBLE_UNSAFE",
        "Irreversible migration lacks approval, backup/export evidence, or a roll-forward plan.",
        "Attach all three before authorizing migration.",
      ),
    );
  }
  return resolutions;
};

const receiptResolutions = (
  input: MigrationPlanInputV1,
  migrationFingerprint: string,
): readonly MigrationResolution[] => {
  const receipt = input.receipt;
  if (!receipt) return [];
  void migrationFingerprint;
  return [
    resolution(
      "MIGRATION_RECEIPT_AUTHORITY_REQUIRED",
      "Caller JSON cannot supply trusted issuer or durable atomic replay-consumption authority.",
      "Inject release-bound trust and atomic check-and-consume out of band before enabling receipt verification.",
    ),
  ];
};

const invalid = (): MigrationPlanResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "plan-only",
  executionAvailable: false,
  resolutions: [
    resolution(
      "MIGRATION_INPUT_INVALID",
      "Migration input does not match the closed V1 contract.",
      "Regenerate it from the reviewed one-prior release transition.",
    ),
  ],
});

export const planMigrationHandoff = (
  candidate: unknown,
): MigrationPlanResult => {
  const input = parseInput(candidate);
  if (!input) return invalid();
  const evidenceRequirements = [...input.migration.evidenceRequirements].sort(
    (left, right) => compareText(left.id, right.id),
  );
  const fingerprintInput = {
    ...input,
    migration: { ...input.migration, evidenceRequirements },
    receipt: undefined,
  };
  const migrationFingerprint = fingerprint(fingerprintInput);
  const resolutions = [
    ...semanticResolutions(input),
    ...receiptResolutions(input, migrationFingerprint),
  ].sort((left, right) => compareText(left.code, right.code));
  if (resolutions.length > 0) {
    return {
      ok: false,
      schemaVersion: 1,
      mode: "plan-only",
      executionAvailable: false,
      resolutions,
    };
  }
  return {
    ok: true,
    schemaVersion: 1,
    mode: "plan-only",
    executionAvailable: false,
    transitionId: input.transition.id,
    migrationId: input.migration.id,
    migrationFingerprint,
    steps: [
      { kind: "expand" },
      { kind: "backward-compatible-code" },
      { kind: "preview" },
      { kind: "migrate" },
      { kind: "compatibility-window" },
      { kind: "contract" },
    ],
    operatorCommand: input.migration.operatorCommand,
    previewCounts: input.migration.previewCounts,
    migrateCounts: input.migration.migrateCounts,
    compatibilityWindow: input.migration.compatibilityWindow,
    evidenceRequirements,
    recovery: input.migration.recovery,
    fileUpgrade: { blocked: true, code: "MIGRATION_RECEIPT_REQUIRED" },
  };
};
