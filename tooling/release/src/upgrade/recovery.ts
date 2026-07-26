import { createHash } from "node:crypto";
import { verifyAppliedUpgrade } from "./verify.js";

export type UpgradeRecoveryCode =
  "UPGRADE_RECOVERY_INPUT_INVALID" | "UPGRADE_RECOVERY_VERIFICATION_FAILED";

export type UpgradeRecoveryResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "plan-only";
      readonly executionAvailable: false;
      readonly strategy: "reviewed-git-revert";
      readonly requestId: string;
      readonly recoveryFingerprint: string;
      readonly verifiedPlanFingerprint: string;
      readonly fromCommit: string;
      readonly restoreCommit: string;
      readonly affectedPaths: readonly string[];
      readonly operatorApprovalRequired: true;
      readonly operatorCommand: string;
      readonly preconditions: readonly [
        "head-matches-verified-upgrade",
        "worktree-clean",
        "operator-approved",
      ];
      readonly customRollbackEngine: false;
      readonly dataRecovery: "separate-authorized-plan";
      readonly providerRecovery: "separate-operator-plan";
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "plan-only";
      readonly executionAvailable: false;
      readonly resolutions: readonly {
        readonly code: UpgradeRecoveryCode;
        readonly message: string;
        readonly repair: string;
        readonly verificationCodes?: readonly string[];
      }[];
    };

type ParsedRecovery = {
  readonly verification: unknown;
  readonly request: {
    readonly id: string;
    readonly requestedAt: string;
    readonly reason: string;
    readonly operatorApprovalRequired: true;
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
const timestamp = (value: unknown): value is string =>
  text(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const parseRecovery = (value: unknown): ParsedRecovery | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, ["schemaVersion", "verification", "request"]) ||
    value.schemaVersion !== 1 ||
    !("verification" in value) ||
    !isRecord(value.request) ||
    !onlyKeys(value.request, [
      "id",
      "requestedAt",
      "reason",
      "operatorApprovalRequired",
    ]) ||
    !text(value.request.id) ||
    !timestamp(value.request.requestedAt) ||
    !text(value.request.reason) ||
    value.request.operatorApprovalRequired !== true
  ) {
    return undefined;
  }
  return {
    verification: value.verification,
    request: {
      id: value.request.id,
      requestedAt: value.request.requestedAt,
      reason: value.request.reason,
      operatorApprovalRequired: true,
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

const failure = (
  code: UpgradeRecoveryCode,
  message: string,
  repair: string,
  verificationCodes?: readonly string[],
): UpgradeRecoveryResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "plan-only",
  executionAvailable: false,
  resolutions: [
    {
      code,
      message,
      repair,
      ...(verificationCodes
        ? { verificationCodes: [...verificationCodes].sort(compareText) }
        : {}),
    },
  ],
});

export const planUpgradeRecovery = (
  candidate: unknown,
): UpgradeRecoveryResult => {
  const input = parseRecovery(candidate);
  if (!input)
    return failure(
      "UPGRADE_RECOVERY_INPUT_INVALID",
      "Recovery input does not match the closed V1 contract.",
      "Regenerate recovery from a verified applied upgrade and explicit operator request.",
    );
  const verification = verifyAppliedUpgrade(input.verification);
  if (!verification.ok)
    return failure(
      "UPGRADE_RECOVERY_VERIFICATION_FAILED",
      "Recovery cannot bind to an unverified upgrade after-state.",
      "Resolve verification findings before planning code recovery.",
      verification.resolutions.map(({ code }) => code),
    );
  const affectedPaths = [...verification.verifiedPaths].sort(compareText);
  const recoveryFingerprint = fingerprint({
    request: input.request,
    verification: {
      planFingerprint: verification.planFingerprint,
      manifestFingerprint: verification.manifestFingerprint,
      fromCommit: verification.upgradedCommit,
      restoreCommit: verification.preUpgradeCommit,
      affectedPaths,
    },
  });
  return {
    ok: true,
    schemaVersion: 1,
    mode: "plan-only",
    executionAvailable: false,
    strategy: "reviewed-git-revert",
    requestId: input.request.id,
    recoveryFingerprint,
    verifiedPlanFingerprint: verification.planFingerprint,
    fromCommit: verification.upgradedCommit,
    restoreCommit: verification.preUpgradeCommit,
    affectedPaths,
    operatorApprovalRequired: true,
    operatorCommand: `git revert --no-commit ${verification.preUpgradeCommit}..${verification.upgradedCommit}`,
    preconditions: [
      "head-matches-verified-upgrade",
      "worktree-clean",
      "operator-approved",
    ],
    customRollbackEngine: false,
    dataRecovery: "separate-authorized-plan",
    providerRecovery: "separate-operator-plan",
  };
};
