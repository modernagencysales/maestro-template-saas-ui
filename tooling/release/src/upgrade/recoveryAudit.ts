import { createHash } from "node:crypto";
import { verifyUpgradeRecovery } from "./recoveryVerify.js";

export type UpgradeRecoveryAuditCode =
  | "UPGRADE_RECOVERY_AUDIT_INPUT_INVALID"
  | "UPGRADE_RECOVERY_AUDIT_VERIFICATION_FAILED"
  | "UPGRADE_RECOVERY_AUDIT_RECEIPT_DRIFT"
  | "UPGRADE_RECOVERY_AUDIT_STALE_WINDOW"
  | "UPGRADE_RECOVERY_AUDIT_DUPLICATE_RECEIPT"
  | "UPGRADE_RECOVERY_AUDIT_DUPLICATE_FINGERPRINT"
  | "UPGRADE_RECOVERY_AUDIT_PATH_EVIDENCE_DRIFT"
  | "UPGRADE_RECOVERY_AUDIT_CROSS_TARGET_REPLAY";

export type UpgradeRecoveryAuditResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "audit-only";
      readonly executionAvailable: false;
      readonly replaySafe: true;
      readonly auditFingerprint: string;
      readonly targetId: string;
      readonly receiptId: string;
      readonly recoveryFingerprint: string;
      readonly recoveryCommit: string;
      readonly pathEvidenceFingerprint: string;
      readonly auditedAt: string;
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "audit-only";
      readonly executionAvailable: false;
      readonly replaySafe: false;
      readonly resolutions: readonly {
        readonly code: UpgradeRecoveryAuditCode;
        readonly message: string;
        readonly repair: string;
        readonly upstreamCodes?: readonly string[];
      }[];
    };

type LedgerRecord = {
  readonly targetId: string;
  readonly receiptId: string;
  readonly recoveryFingerprint: string;
  readonly recoveryCommit: string;
};

type ParsedAudit = {
  readonly verificationInput: unknown;
  readonly acceptedRecord: LedgerRecord & {
    readonly pathEvidenceFingerprint: string;
  };
  readonly audit: {
    readonly targetId: string;
    readonly windowOpensAt: string;
    readonly windowClosesAt: string;
    readonly auditedAt: string;
    readonly priorReceipts: readonly LedgerRecord[];
  };
};

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
const commit = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
const timestamp = (value: unknown): value is string =>
  text(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const readLedgerRecord = (value: unknown): LedgerRecord | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "targetId",
      "receiptId",
      "recoveryFingerprint",
      "recoveryCommit",
    ]) ||
    !text(value.targetId) ||
    !text(value.receiptId) ||
    !digest(value.recoveryFingerprint) ||
    !commit(value.recoveryCommit)
  )
    return undefined;
  return {
    targetId: value.targetId,
    receiptId: value.receiptId,
    recoveryFingerprint: value.recoveryFingerprint,
    recoveryCommit: value.recoveryCommit,
  };
};

const parseAudit = (value: unknown): ParsedAudit | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "schemaVersion",
      "verificationInput",
      "acceptedRecord",
      "audit",
    ]) ||
    value.schemaVersion !== 1 ||
    !("verificationInput" in value) ||
    !isRecord(value.acceptedRecord) ||
    !onlyKeys(value.acceptedRecord, [
      "targetId",
      "receiptId",
      "recoveryFingerprint",
      "recoveryCommit",
      "pathEvidenceFingerprint",
    ]) ||
    !digest(value.acceptedRecord.pathEvidenceFingerprint) ||
    !isRecord(value.audit) ||
    !onlyKeys(value.audit, [
      "targetId",
      "windowOpensAt",
      "windowClosesAt",
      "auditedAt",
      "priorReceipts",
    ]) ||
    !text(value.audit.targetId) ||
    !timestamp(value.audit.windowOpensAt) ||
    !timestamp(value.audit.windowClosesAt) ||
    !timestamp(value.audit.auditedAt) ||
    !Array.isArray(value.audit.priorReceipts)
  ) {
    return undefined;
  }
  const acceptedRecord = readLedgerRecord({
    targetId: value.acceptedRecord.targetId,
    receiptId: value.acceptedRecord.receiptId,
    recoveryFingerprint: value.acceptedRecord.recoveryFingerprint,
    recoveryCommit: value.acceptedRecord.recoveryCommit,
  });
  const priorReceipts = value.audit.priorReceipts.map(readLedgerRecord);
  if (!acceptedRecord || priorReceipts.some((record) => record === undefined))
    return undefined;
  return {
    verificationInput: value.verificationInput,
    acceptedRecord: {
      ...acceptedRecord,
      pathEvidenceFingerprint: value.acceptedRecord.pathEvidenceFingerprint,
    },
    audit: {
      targetId: value.audit.targetId,
      windowOpensAt: value.audit.windowOpensAt,
      windowClosesAt: value.audit.windowClosesAt,
      auditedAt: value.audit.auditedAt,
      priorReceipts: priorReceipts as LedgerRecord[],
    },
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
const fingerprint = (value: unknown): string =>
  `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;

const observedPaths = (
  verificationInput: unknown,
): readonly unknown[] | undefined => {
  if (!isRecord(verificationInput) || !isRecord(verificationInput.observed))
    return undefined;
  return Array.isArray(verificationInput.observed.paths)
    ? verificationInput.observed.paths
    : undefined;
};

const pathFingerprint = (verificationInput: unknown): string | undefined => {
  const paths = observedPaths(verificationInput);
  if (!paths) return undefined;
  const normalized = paths
    .map((path) => canonicalize(path))
    .sort((left, right) =>
      compareText(JSON.stringify(left), JSON.stringify(right)),
    );
  return fingerprint({ paths: normalized });
};

export const recoveryPathEvidenceFingerprint = (
  verificationInput: unknown,
): string | undefined => {
  const verification = verifyUpgradeRecovery(verificationInput);
  return verification.ok ? pathFingerprint(verificationInput) : undefined;
};

const failed = (
  code: UpgradeRecoveryAuditCode,
  message: string,
  repair: string,
  upstreamCodes?: readonly string[],
): UpgradeRecoveryAuditResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "audit-only",
  executionAvailable: false,
  replaySafe: false,
  resolutions: [
    {
      code,
      message,
      repair,
      ...(upstreamCodes
        ? { upstreamCodes: [...upstreamCodes].sort(compareText) }
        : {}),
    },
  ],
});

export const auditUpgradeRecovery = (
  candidate: unknown,
): UpgradeRecoveryAuditResult => {
  const input = parseAudit(candidate);
  if (!input)
    return failed(
      "UPGRADE_RECOVERY_AUDIT_INPUT_INVALID",
      "Recovery audit input does not match the closed V1 contract.",
      "Regenerate audit evidence from the accepted recovery receipt.",
    );
  const verification = verifyUpgradeRecovery(input.verificationInput);
  if (!verification.ok)
    return failed(
      "UPGRADE_RECOVERY_AUDIT_VERIFICATION_FAILED",
      "Accepted recovery no longer passes deterministic verification.",
      "Resolve recovery verification drift before replay audit.",
      verification.resolutions.map(({ code }) => code),
    );
  const currentPathFingerprint = pathFingerprint(input.verificationInput);
  if (!currentPathFingerprint)
    return failed(
      "UPGRADE_RECOVERY_AUDIT_INPUT_INVALID",
      "Verified recovery has no canonical path evidence.",
      "Capture the exact restored path evidence before audit.",
    );
  if (
    input.acceptedRecord.receiptId !== verification.receiptId ||
    input.acceptedRecord.recoveryFingerprint !==
      verification.recoveryFingerprint ||
    input.acceptedRecord.recoveryCommit !== verification.recoveryCommit
  )
    return failed(
      "UPGRADE_RECOVERY_AUDIT_RECEIPT_DRIFT",
      "Accepted receipt identity differs from the verified recovery.",
      "Use the immutable accepted receipt record for audit.",
    );
  if (
    input.audit.windowOpensAt > input.audit.windowClosesAt ||
    input.audit.auditedAt < input.audit.windowOpensAt ||
    input.audit.auditedAt > input.audit.windowClosesAt
  )
    return failed(
      "UPGRADE_RECOVERY_AUDIT_STALE_WINDOW",
      "Recovery audit is outside its accepted replay window.",
      "Create a newly reviewed audit window; do not reuse stale authority.",
    );
  if (input.acceptedRecord.targetId !== input.audit.targetId)
    return failed(
      "UPGRADE_RECOVERY_AUDIT_CROSS_TARGET_REPLAY",
      "Accepted recovery target differs from the audit target.",
      "Regenerate recovery authority for the exact target.",
    );
  const crossTarget = input.audit.priorReceipts.some(
    (record) =>
      record.targetId !== input.audit.targetId &&
      (record.receiptId === input.acceptedRecord.receiptId ||
        record.recoveryFingerprint ===
          input.acceptedRecord.recoveryFingerprint),
  );
  if (crossTarget)
    return failed(
      "UPGRADE_RECOVERY_AUDIT_CROSS_TARGET_REPLAY",
      "Receipt or recovery fingerprint was previously used for another target.",
      "Reject the replay and issue target-specific recovery authority.",
    );
  if (
    input.audit.priorReceipts.some(
      ({ receiptId }) => receiptId === input.acceptedRecord.receiptId,
    )
  )
    return failed(
      "UPGRADE_RECOVERY_AUDIT_DUPLICATE_RECEIPT",
      "Recovery receipt was already consumed by the audit ledger.",
      "Treat the existing audit record as authoritative; do not replay it.",
    );
  if (
    input.audit.priorReceipts.some(
      ({ recoveryFingerprint }) =>
        recoveryFingerprint === input.acceptedRecord.recoveryFingerprint,
    )
  )
    return failed(
      "UPGRADE_RECOVERY_AUDIT_DUPLICATE_FINGERPRINT",
      "Recovery fingerprint was already consumed by the audit ledger.",
      "Reject duplicate use of the same reviewed recovery plan.",
    );
  if (input.acceptedRecord.pathEvidenceFingerprint !== currentPathFingerprint)
    return failed(
      "UPGRADE_RECOVERY_AUDIT_PATH_EVIDENCE_DRIFT",
      "Current restored-path evidence differs from the accepted record.",
      "Preserve both artifacts and resolve the evidence drift.",
    );
  const auditFingerprint = fingerprint({
    acceptedRecord: input.acceptedRecord,
    auditedAt: input.audit.auditedAt,
    recovery: {
      receiptId: verification.receiptId,
      recoveryFingerprint: verification.recoveryFingerprint,
      recoveryCommit: verification.recoveryCommit,
      verifiedPaths: verification.verifiedPaths,
    },
    targetId: input.audit.targetId,
    window: {
      opensAt: input.audit.windowOpensAt,
      closesAt: input.audit.windowClosesAt,
    },
  });
  return {
    ok: true,
    schemaVersion: 1,
    mode: "audit-only",
    executionAvailable: false,
    replaySafe: true,
    auditFingerprint,
    targetId: input.audit.targetId,
    receiptId: verification.receiptId,
    recoveryFingerprint: verification.recoveryFingerprint,
    recoveryCommit: verification.recoveryCommit,
    pathEvidenceFingerprint: currentPathFingerprint,
    auditedAt: input.audit.auditedAt,
  };
};
