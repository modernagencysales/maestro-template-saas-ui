import { createHash } from "node:crypto";
import { planUpgradeRecovery } from "./recovery.js";
import { auditUpgradeRecovery } from "./recoveryAudit.js";
import { verifyUpgradeRecovery } from "./recoveryVerify.js";

export type UpgradeRecoveryCheckpointCode =
  | "UPGRADE_RECOVERY_CHECKPOINT_INPUT_INVALID"
  | "UPGRADE_RECOVERY_CHECKPOINT_AUDIT_FAILED"
  | "UPGRADE_RECOVERY_CHECKPOINT_STALE"
  | "UPGRADE_RECOVERY_CHECKPOINT_DUPLICATE"
  | "UPGRADE_RECOVERY_CHECKPOINT_CROSS_TARGET"
  | "UPGRADE_RECOVERY_CHECKPOINT_DIRTY"
  | "UPGRADE_RECOVERY_CHECKPOINT_INCOMPLETE"
  | "UPGRADE_RECOVERY_CHECKPOINT_CHAIN_INVALID";

export type UpgradeRecoveryCheckpointResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "compile-only";
      readonly executionAvailable: false;
      readonly complete: true;
      readonly checkpointFingerprint: string;
      readonly auditFingerprint: string;
      readonly targetId: string;
      readonly receiptId: string;
      readonly upgradePlanFingerprint: string;
      readonly recoveryFingerprint: string;
      readonly restoredCommit: string;
      readonly recoveryCommit: string;
      readonly pathEvidenceDigest: string;
      readonly acceptedAt: string;
      readonly rollbackPosture: {
        readonly code: "git-owned";
        readonly customRollbackEngine: false;
        readonly data: "separate-authorized-plan";
        readonly provider: "separate-operator-plan";
      };
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "compile-only";
      readonly executionAvailable: false;
      readonly complete: false;
      readonly resolutions: readonly {
        readonly code: UpgradeRecoveryCheckpointCode;
        readonly message: string;
        readonly repair: string;
        readonly upstreamCodes?: readonly string[];
      }[];
    };

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const onlyKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => Object.keys(value).every((key) => keys.includes(key));

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

const failed = (
  code: UpgradeRecoveryCheckpointCode,
  message: string,
  repair: string,
  upstreamCodes?: readonly string[],
): UpgradeRecoveryCheckpointResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "compile-only",
  executionAvailable: false,
  complete: false,
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

const checkpointCode = (
  auditCode: string,
  upstreamCodes: readonly string[],
): UpgradeRecoveryCheckpointCode => {
  if (auditCode === "UPGRADE_RECOVERY_AUDIT_STALE_WINDOW")
    return "UPGRADE_RECOVERY_CHECKPOINT_STALE";
  if (
    auditCode === "UPGRADE_RECOVERY_AUDIT_DUPLICATE_RECEIPT" ||
    auditCode === "UPGRADE_RECOVERY_AUDIT_DUPLICATE_FINGERPRINT"
  )
    return "UPGRADE_RECOVERY_CHECKPOINT_DUPLICATE";
  if (auditCode === "UPGRADE_RECOVERY_AUDIT_CROSS_TARGET_REPLAY")
    return "UPGRADE_RECOVERY_CHECKPOINT_CROSS_TARGET";
  if (upstreamCodes.includes("UPGRADE_RECOVERY_VERIFY_TARGET_DIRTY"))
    return "UPGRADE_RECOVERY_CHECKPOINT_DIRTY";
  if (
    auditCode === "UPGRADE_RECOVERY_AUDIT_PATH_EVIDENCE_DRIFT" ||
    upstreamCodes.some((code) =>
      [
        "UPGRADE_RECOVERY_VERIFY_EVIDENCE_MISSING",
        "UPGRADE_RECOVERY_VERIFY_EVIDENCE_UNEXPECTED",
        "UPGRADE_RECOVERY_VERIFY_HASH_MISMATCH",
        "UPGRADE_RECOVERY_VERIFY_EXPECTED_ABSENT",
      ].includes(code),
    )
  )
    return "UPGRADE_RECOVERY_CHECKPOINT_INCOMPLETE";
  return "UPGRADE_RECOVERY_CHECKPOINT_AUDIT_FAILED";
};

const nested = (
  auditInput: unknown,
):
  | { readonly verificationInput: unknown; readonly recoveryInput: unknown }
  | undefined => {
  if (!isRecord(auditInput) || !("verificationInput" in auditInput))
    return undefined;
  const verificationInput = auditInput.verificationInput;
  if (!isRecord(verificationInput) || !("recoveryInput" in verificationInput))
    return undefined;
  return {
    verificationInput,
    recoveryInput: verificationInput.recoveryInput,
  };
};

export const compileRecoveryCheckpoint = (
  candidate: unknown,
): UpgradeRecoveryCheckpointResult => {
  if (
    !isRecord(candidate) ||
    !onlyKeys(candidate, ["schemaVersion", "auditInput"]) ||
    candidate.schemaVersion !== 1 ||
    !("auditInput" in candidate)
  )
    return failed(
      "UPGRADE_RECOVERY_CHECKPOINT_INPUT_INVALID",
      "Checkpoint input does not match the closed V1 contract.",
      "Provide only the accepted recovery audit input.",
    );
  const audit = auditUpgradeRecovery(candidate.auditInput);
  if (!audit.ok) {
    const upstreamCodes = audit.resolutions.flatMap((entry) => [
      entry.code,
      ...(entry.upstreamCodes ?? []),
    ]);
    return failed(
      checkpointCode(audit.resolutions[0]?.code ?? "", upstreamCodes),
      "Accepted recovery audit failed closed checkpoint compilation.",
      "Resolve the audit findings before compiling checkpoint evidence.",
      upstreamCodes,
    );
  }
  const chain = nested(candidate.auditInput);
  if (!chain)
    return failed(
      "UPGRADE_RECOVERY_CHECKPOINT_CHAIN_INVALID",
      "Accepted audit does not expose its verified recovery chain.",
      "Regenerate the checkpoint from canonical recovery evidence.",
    );
  const verification = verifyUpgradeRecovery(chain.verificationInput);
  const recovery = planUpgradeRecovery(chain.recoveryInput);
  if (!verification.ok || !recovery.ok)
    return failed(
      "UPGRADE_RECOVERY_CHECKPOINT_CHAIN_INVALID",
      "Recovery verification or rollback posture no longer validates.",
      "Preserve the evidence and rebuild the complete accepted chain.",
      [
        ...(verification.ok
          ? []
          : verification.resolutions.map(({ code }) => code)),
        ...(recovery.ok ? [] : recovery.resolutions.map(({ code }) => code)),
      ],
    );
  if (
    recovery.recoveryFingerprint !== audit.recoveryFingerprint ||
    verification.recoveryFingerprint !== audit.recoveryFingerprint ||
    verification.recoveryCommit !== audit.recoveryCommit ||
    recovery.dataRecovery !== "separate-authorized-plan" ||
    recovery.providerRecovery !== "separate-operator-plan" ||
    recovery.customRollbackEngine !== false
  )
    return failed(
      "UPGRADE_RECOVERY_CHECKPOINT_CHAIN_INVALID",
      "Recovery chain identities or rollback posture have drifted.",
      "Regenerate the packet from one exact accepted recovery chain.",
    );
  const rollbackPosture = {
    code: "git-owned" as const,
    customRollbackEngine: false as const,
    data: "separate-authorized-plan" as const,
    provider: "separate-operator-plan" as const,
  };
  const packet = {
    auditFingerprint: audit.auditFingerprint,
    targetId: audit.targetId,
    receiptId: audit.receiptId,
    upgradePlanFingerprint: recovery.verifiedPlanFingerprint,
    recoveryFingerprint: audit.recoveryFingerprint,
    restoredCommit: verification.restoredFromCommit,
    recoveryCommit: audit.recoveryCommit,
    pathEvidenceDigest: audit.pathEvidenceFingerprint,
    acceptedAt: audit.auditedAt,
    rollbackPosture,
  };
  return {
    ok: true,
    schemaVersion: 1,
    mode: "compile-only",
    executionAvailable: false,
    complete: true,
    checkpointFingerprint: fingerprint(packet),
    ...packet,
  };
};
