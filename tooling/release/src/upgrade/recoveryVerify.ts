import { planUpgrade } from "./plan.js";
import { planUpgradeRecovery } from "./recovery.js";

export type UpgradeRecoveryVerificationCode =
  | "UPGRADE_RECOVERY_VERIFY_INPUT_INVALID"
  | "UPGRADE_RECOVERY_VERIFY_PLAN_BLOCKED"
  | "UPGRADE_RECOVERY_VERIFY_FINGERPRINT_MISMATCH"
  | "UPGRADE_RECOVERY_VERIFY_RECEIPT_TAMPERED"
  | "UPGRADE_RECOVERY_VERIFY_UNAUTHORIZED"
  | "UPGRADE_RECOVERY_VERIFY_TARGET_DIRTY"
  | "UPGRADE_RECOVERY_VERIFY_COMMIT_MISMATCH"
  | "UPGRADE_RECOVERY_VERIFY_EVIDENCE_MISSING"
  | "UPGRADE_RECOVERY_VERIFY_EVIDENCE_UNEXPECTED"
  | "UPGRADE_RECOVERY_VERIFY_HASH_MISMATCH"
  | "UPGRADE_RECOVERY_VERIFY_EXPECTED_ABSENT";

export type UpgradeRecoveryVerificationResolution = {
  readonly code: UpgradeRecoveryVerificationCode;
  readonly path?: string;
  readonly message: string;
  readonly repair: string;
  readonly upstreamCodes?: readonly string[];
};

export type UpgradeRecoveryVerificationResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "verify-only";
      readonly executionAvailable: false;
      readonly recovered: true;
      readonly verified: true;
      readonly recoveryFingerprint: string;
      readonly receiptId: string;
      readonly startedFromCommit: string;
      readonly restoredFromCommit: string;
      readonly recoveryCommit: string;
      readonly verifiedPaths: readonly string[];
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "verify-only";
      readonly executionAvailable: false;
      readonly recovered: false;
      readonly verified: false;
      readonly resolutions: readonly UpgradeRecoveryVerificationResolution[];
    };

type PathState =
  | { readonly path: string; readonly state: "absent" }
  | { readonly path: string; readonly state: "present"; readonly hash: string };

type ParsedInput = {
  readonly recoveryInput: unknown;
  readonly expectedRecoveryFingerprint: string;
  readonly receipt: {
    readonly id: string;
    readonly recoveryFingerprint: string;
    readonly startedFromCommit: string;
    readonly restoredFromCommit: string;
    readonly recoveryCommit: string;
    readonly completedAt: string;
    readonly approved: boolean;
    readonly authorizationEvidenceRef: string;
  };
  readonly observed: {
    readonly currentCommit: string;
    readonly clean: boolean;
    readonly paths: readonly PathState[];
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

const parseInput = (value: unknown): ParsedInput | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "schemaVersion",
      "recoveryInput",
      "expectedRecoveryFingerprint",
      "receipt",
      "observed",
    ]) ||
    value.schemaVersion !== 1 ||
    !("recoveryInput" in value) ||
    !digest(value.expectedRecoveryFingerprint) ||
    !isRecord(value.receipt) ||
    !onlyKeys(value.receipt, [
      "schemaVersion",
      "id",
      "recoveryFingerprint",
      "status",
      "startedFromCommit",
      "restoredFromCommit",
      "recoveryCommit",
      "completedAt",
      "authorization",
    ]) ||
    value.receipt.schemaVersion !== 1 ||
    !text(value.receipt.id) ||
    !digest(value.receipt.recoveryFingerprint) ||
    value.receipt.status !== "completed" ||
    !commit(value.receipt.startedFromCommit) ||
    !commit(value.receipt.restoredFromCommit) ||
    !commit(value.receipt.recoveryCommit) ||
    !timestamp(value.receipt.completedAt) ||
    !isRecord(value.receipt.authorization) ||
    !onlyKeys(value.receipt.authorization, ["approved", "evidenceRef"]) ||
    typeof value.receipt.authorization.approved !== "boolean" ||
    !text(value.receipt.authorization.evidenceRef) ||
    !isRecord(value.observed) ||
    !onlyKeys(value.observed, ["currentCommit", "clean", "paths"]) ||
    !commit(value.observed.currentCommit) ||
    typeof value.observed.clean !== "boolean" ||
    !Array.isArray(value.observed.paths)
  ) {
    return undefined;
  }
  const paths = value.observed.paths.map((entry) => {
    if (
      !isRecord(entry) ||
      !text(entry.path) ||
      (entry.state !== "present" && entry.state !== "absent")
    )
      return undefined;
    if (entry.state === "absent") {
      if (!onlyKeys(entry, ["path", "state"])) return undefined;
      return { path: entry.path, state: "absent" as const };
    }
    if (!onlyKeys(entry, ["path", "state", "hash"]) || !digest(entry.hash))
      return undefined;
    return { path: entry.path, state: "present" as const, hash: entry.hash };
  });
  if (
    paths.some((entry) => entry === undefined) ||
    new Set(paths.map((entry) => entry?.path)).size !== paths.length
  )
    return undefined;
  return {
    recoveryInput: value.recoveryInput,
    expectedRecoveryFingerprint: value.expectedRecoveryFingerprint,
    receipt: {
      id: value.receipt.id,
      recoveryFingerprint: value.receipt.recoveryFingerprint,
      startedFromCommit: value.receipt.startedFromCommit,
      restoredFromCommit: value.receipt.restoredFromCommit,
      recoveryCommit: value.receipt.recoveryCommit,
      completedAt: value.receipt.completedAt,
      approved: value.receipt.authorization.approved,
      authorizationEvidenceRef: value.receipt.authorization.evidenceRef,
    },
    observed: {
      currentCommit: value.observed.currentCommit,
      clean: value.observed.clean,
      paths: paths as PathState[],
    },
  };
};

const resolution = (
  code: UpgradeRecoveryVerificationCode,
  message: string,
  repair: string,
  options?: {
    readonly path?: string;
    readonly upstreamCodes?: readonly string[];
  },
): UpgradeRecoveryVerificationResolution => ({
  code,
  ...(options?.path ? { path: options.path } : {}),
  message,
  repair,
  ...(options?.upstreamCodes
    ? { upstreamCodes: [...options.upstreamCodes].sort(compareText) }
    : {}),
});

const failed = (
  resolutions: readonly UpgradeRecoveryVerificationResolution[],
): UpgradeRecoveryVerificationResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "verify-only",
  executionAvailable: false,
  recovered: false,
  verified: false,
  resolutions: [...resolutions].sort((left, right) => {
    const code = compareText(left.code, right.code);
    return code === 0 ? compareText(left.path ?? "", right.path ?? "") : code;
  }),
});

const upgradePlanInput = (recoveryInput: unknown): unknown => {
  if (!isRecord(recoveryInput) || !isRecord(recoveryInput.verification))
    return undefined;
  return recoveryInput.verification.planInput;
};

export const verifyUpgradeRecovery = (
  candidate: unknown,
): UpgradeRecoveryVerificationResult => {
  const input = parseInput(candidate);
  if (!input)
    return failed([
      resolution(
        "UPGRADE_RECOVERY_VERIFY_INPUT_INVALID",
        "Recovery verification input does not match the closed V1 contract.",
        "Regenerate evidence from the exact recovery plan and completed receipt.",
      ),
    ]);
  const recovery = planUpgradeRecovery(input.recoveryInput);
  if (!recovery.ok)
    return failed([
      resolution(
        "UPGRADE_RECOVERY_VERIFY_PLAN_BLOCKED",
        "Recovery plan is not valid for verification.",
        "Resolve the recovery plan findings before verifying a receipt.",
        { upstreamCodes: recovery.resolutions.map(({ code }) => code) },
      ),
    ]);
  if (
    input.expectedRecoveryFingerprint !== recovery.recoveryFingerprint ||
    input.receipt.recoveryFingerprint !== recovery.recoveryFingerprint
  )
    return failed([
      resolution(
        "UPGRADE_RECOVERY_VERIFY_FINGERPRINT_MISMATCH",
        "Recovery receipt or expectation has a stale plan fingerprint.",
        "Discard stale evidence and use the exact reviewed recovery plan.",
      ),
    ]);
  if (!input.receipt.approved)
    return failed([
      resolution(
        "UPGRADE_RECOVERY_VERIFY_UNAUTHORIZED",
        "Recovery receipt lacks explicit operator approval.",
        "Attach approval evidence through the reviewed recovery process.",
      ),
    ]);

  const resolutions: UpgradeRecoveryVerificationResolution[] = [];
  if (
    input.receipt.startedFromCommit !== recovery.fromCommit ||
    input.receipt.restoredFromCommit !== recovery.restoreCommit ||
    input.receipt.recoveryCommit === recovery.fromCommit ||
    input.receipt.recoveryCommit === recovery.restoreCommit
  )
    resolutions.push(
      resolution(
        "UPGRADE_RECOVERY_VERIFY_RECEIPT_TAMPERED",
        "Recovery receipt commit identities do not match the reviewed plan.",
        "Produce a fresh receipt from the exact reviewed Git recovery.",
      ),
    );
  if (!input.observed.clean)
    resolutions.push(
      resolution(
        "UPGRADE_RECOVERY_VERIFY_TARGET_DIRTY",
        "Recovered worktree is not clean.",
        "Commit the exact recovered state before verification.",
      ),
    );
  if (input.observed.currentCommit !== input.receipt.recoveryCommit)
    resolutions.push(
      resolution(
        "UPGRADE_RECOVERY_VERIFY_COMMIT_MISMATCH",
        "Observed recovery commit does not match the completed receipt.",
        "Capture evidence from the exact recovery commit.",
      ),
    );

  const upgrade = planUpgrade(upgradePlanInput(input.recoveryInput));
  if (!upgrade.ok)
    return failed([
      ...resolutions,
      resolution(
        "UPGRADE_RECOVERY_VERIFY_PLAN_BLOCKED",
        "Underlying upgrade plan cannot derive the restored tree.",
        "Regenerate recovery from the reviewed collision-free upgrade plan.",
        { upstreamCodes: upgrade.resolutions.map(({ code }) => code) },
      ),
    ]);
  const expected = new Map<string, PathState>();
  for (const entry of upgrade.diff) {
    if (entry.kind === "add") {
      expected.set(entry.path, { path: entry.path, state: "absent" });
    } else if (entry.kind === "move") {
      if (entry.fromPath)
        expected.set(entry.fromPath, {
          path: entry.fromPath,
          state: "present",
          hash: entry.beforeHash ?? "",
        });
      expected.set(entry.path, { path: entry.path, state: "absent" });
    } else {
      expected.set(entry.path, {
        path: entry.path,
        state: "present",
        hash: entry.beforeHash ?? "",
      });
    }
  }
  const observed = new Map(
    input.observed.paths.map((entry) => [entry.path, entry]),
  );
  for (const [path, expectedState] of expected) {
    const observedState = observed.get(path);
    if (!observedState)
      resolutions.push(
        resolution(
          "UPGRADE_RECOVERY_VERIFY_EVIDENCE_MISSING",
          `Recovery evidence is missing for "${path}".`,
          "Capture explicit present or absent state for every restored path.",
          { path },
        ),
      );
    else if (
      expectedState.state === "absent" &&
      observedState.state !== "absent"
    )
      resolutions.push(
        resolution(
          "UPGRADE_RECOVERY_VERIFY_EXPECTED_ABSENT",
          `Path "${path}" should be absent after recovery.`,
          "Restore the reviewed absence before verification.",
          { path },
        ),
      );
    else if (
      expectedState.state === "present" &&
      (observedState.state !== "present" ||
        observedState.hash !== expectedState.hash)
    )
      resolutions.push(
        resolution(
          "UPGRADE_RECOVERY_VERIFY_HASH_MISMATCH",
          `Path "${path}" does not match its reviewed pre-upgrade hash.`,
          "Restore the exact reviewed bytes before verification.",
          { path },
        ),
      );
  }
  for (const path of observed.keys()) {
    if (!expected.has(path))
      resolutions.push(
        resolution(
          "UPGRADE_RECOVERY_VERIFY_EVIDENCE_UNEXPECTED",
          `Recovery evidence includes unplanned path "${path}".`,
          "Remove unrelated evidence and verify only restored upgrade paths.",
          { path },
        ),
      );
  }
  if (resolutions.length > 0) return failed(resolutions);
  return {
    ok: true,
    schemaVersion: 1,
    mode: "verify-only",
    executionAvailable: false,
    recovered: true,
    verified: true,
    recoveryFingerprint: recovery.recoveryFingerprint,
    receiptId: input.receipt.id,
    startedFromCommit: input.receipt.startedFromCommit,
    restoredFromCommit: input.receipt.restoredFromCommit,
    recoveryCommit: input.receipt.recoveryCommit,
    verifiedPaths: [...expected.keys()].sort(compareText),
  };
};
