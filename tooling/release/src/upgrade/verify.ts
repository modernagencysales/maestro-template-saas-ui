import { planUpgrade } from "./plan.js";

export type UpgradeVerificationCode =
  | "UPGRADE_VERIFY_INPUT_INVALID"
  | "UPGRADE_VERIFY_PLAN_BLOCKED"
  | "UPGRADE_VERIFY_FINGERPRINT_MISMATCH"
  | "UPGRADE_VERIFY_TARGET_DIRTY"
  | "UPGRADE_VERIFY_PRE_COMMIT_MISMATCH"
  | "UPGRADE_VERIFY_COMMIT_NOT_ADVANCED"
  | "UPGRADE_VERIFY_EVIDENCE_MISSING"
  | "UPGRADE_VERIFY_EVIDENCE_UNEXPECTED"
  | "UPGRADE_VERIFY_AFTER_HASH_MISMATCH"
  | "UPGRADE_VERIFY_EXPECTED_ABSENT";

export type UpgradeVerificationResolution = {
  readonly code: UpgradeVerificationCode;
  readonly path?: string;
  readonly message: string;
  readonly repair: string;
  readonly planCodes?: readonly string[];
};

export type UpgradeVerificationResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "verify-only";
      readonly writeAvailable: false;
      readonly applied: true;
      readonly verified: true;
      readonly planFingerprint: string;
      readonly manifestFingerprint: string;
      readonly preUpgradeCommit: string;
      readonly upgradedCommit: string;
      readonly verifiedPaths: readonly string[];
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "verify-only";
      readonly writeAvailable: false;
      readonly applied: false;
      readonly verified: false;
      readonly resolutions: readonly UpgradeVerificationResolution[];
    };

type ObservedPath =
  | { readonly path: string; readonly state: "absent" }
  | { readonly path: string; readonly state: "present"; readonly hash: string };

type ParsedVerification = {
  readonly planInput: unknown;
  readonly expectedPlanFingerprint: string;
  readonly observed: {
    readonly preUpgradeCommit: string;
    readonly upgradedCommit: string;
    readonly clean: boolean;
    readonly paths: readonly ObservedPath[];
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

const parseVerification = (value: unknown): ParsedVerification | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "schemaVersion",
      "planInput",
      "expectedPlanFingerprint",
      "observed",
    ]) ||
    value.schemaVersion !== 1 ||
    !("planInput" in value) ||
    !digest(value.expectedPlanFingerprint) ||
    !isRecord(value.observed) ||
    !onlyKeys(value.observed, [
      "preUpgradeCommit",
      "upgradedCommit",
      "clean",
      "paths",
    ]) ||
    !commit(value.observed.preUpgradeCommit) ||
    !commit(value.observed.upgradedCommit) ||
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
    planInput: value.planInput,
    expectedPlanFingerprint: value.expectedPlanFingerprint,
    observed: {
      preUpgradeCommit: value.observed.preUpgradeCommit,
      upgradedCommit: value.observed.upgradedCommit,
      clean: value.observed.clean,
      paths: paths as ObservedPath[],
    },
  };
};

const failure = (
  code: UpgradeVerificationCode,
  message: string,
  repair: string,
  options?: { readonly path?: string; readonly planCodes?: readonly string[] },
): UpgradeVerificationResolution => ({
  code,
  ...(options?.path ? { path: options.path } : {}),
  message,
  repair,
  ...(options?.planCodes ? { planCodes: [...options.planCodes] } : {}),
});

const failed = (
  resolutions: readonly UpgradeVerificationResolution[],
): UpgradeVerificationResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "verify-only",
  writeAvailable: false,
  applied: false,
  verified: false,
  resolutions: [...resolutions].sort((left, right) => {
    const code = compareText(left.code, right.code);
    return code === 0 ? compareText(left.path ?? "", right.path ?? "") : code;
  }),
});

export const verifyAppliedUpgrade = (
  candidate: unknown,
): UpgradeVerificationResult => {
  const input = parseVerification(candidate);
  if (!input)
    return failed([
      failure(
        "UPGRADE_VERIFY_INPUT_INVALID",
        "Upgrade verification input does not match the closed V1 contract.",
        "Capture the committed after-state from the reviewed upgrade plan.",
      ),
    ]);
  const plan = planUpgrade(input.planInput);
  if (!plan.ok)
    return failed([
      failure(
        "UPGRADE_VERIFY_PLAN_BLOCKED",
        "The source upgrade plan is not collision-free.",
        "Resolve the plan findings before claiming an applied upgrade.",
        { planCodes: plan.resolutions.map(({ code }) => code) },
      ),
    ]);
  if (plan.planFingerprint !== input.expectedPlanFingerprint)
    return failed([
      failure(
        "UPGRADE_VERIFY_FINGERPRINT_MISMATCH",
        "Expected plan fingerprint does not match the reviewed plan.",
        "Discard stale evidence and verify against the exact applied plan.",
      ),
    ]);

  const resolutions: UpgradeVerificationResolution[] = [];
  if (!input.observed.clean)
    resolutions.push(
      failure(
        "UPGRADE_VERIFY_TARGET_DIRTY",
        "Upgraded worktree is not clean.",
        "Commit the exact upgrade result before verification.",
      ),
    );
  if (input.observed.preUpgradeCommit !== plan.targetCommit)
    resolutions.push(
      failure(
        "UPGRADE_VERIFY_PRE_COMMIT_MISMATCH",
        "Pre-upgrade commit does not match the reviewed target commit.",
        "Rebuild verification evidence from the exact planned target.",
      ),
    );
  if (input.observed.upgradedCommit === input.observed.preUpgradeCommit)
    resolutions.push(
      failure(
        "UPGRADE_VERIFY_COMMIT_NOT_ADVANCED",
        "No distinct upgraded commit was recorded.",
        "Commit the applied after-state before verification.",
      ),
    );

  const expected = new Map<string, ObservedPath>();
  for (const entry of plan.diff) {
    if (entry.kind === "delete") {
      expected.set(entry.path, { path: entry.path, state: "absent" });
    } else if (entry.kind === "move") {
      if (entry.fromPath)
        expected.set(entry.fromPath, {
          path: entry.fromPath,
          state: "absent",
        });
      expected.set(entry.path, {
        path: entry.path,
        state: "present",
        hash: entry.afterHash ?? "",
      });
    } else {
      expected.set(entry.path, {
        path: entry.path,
        state: "present",
        hash: entry.afterHash ?? "",
      });
    }
  }
  const observed = new Map(
    input.observed.paths.map((entry) => [entry.path, entry]),
  );
  for (const [path, expectedState] of expected) {
    const observedState = observed.get(path);
    if (!observedState) {
      resolutions.push(
        failure(
          "UPGRADE_VERIFY_EVIDENCE_MISSING",
          `Verification evidence is missing for "${path}".`,
          "Capture explicit present or absent state for every planned path.",
          { path },
        ),
      );
    } else if (
      expectedState.state === "absent" &&
      observedState.state !== "absent"
    ) {
      resolutions.push(
        failure(
          "UPGRADE_VERIFY_EXPECTED_ABSENT",
          `Path "${path}" remains present after delete or move.`,
          "Restore the reviewed absence before verification.",
          { path },
        ),
      );
    } else if (
      expectedState.state === "present" &&
      (observedState.state !== "present" ||
        observedState.hash !== expectedState.hash)
    ) {
      resolutions.push(
        failure(
          "UPGRADE_VERIFY_AFTER_HASH_MISMATCH",
          `Path "${path}" does not match the reviewed after hash.`,
          "Preserve the evidence and resolve the after-state mismatch.",
          { path },
        ),
      );
    }
  }
  for (const path of observed.keys()) {
    if (!expected.has(path))
      resolutions.push(
        failure(
          "UPGRADE_VERIFY_EVIDENCE_UNEXPECTED",
          `Verification includes unplanned path "${path}".`,
          "Remove unrelated evidence and verify only reviewed operations.",
          { path },
        ),
      );
  }
  if (resolutions.length > 0) return failed(resolutions);
  return {
    ok: true,
    schemaVersion: 1,
    mode: "verify-only",
    writeAvailable: false,
    applied: true,
    verified: true,
    planFingerprint: plan.planFingerprint,
    manifestFingerprint: plan.manifestFingerprint,
    preUpgradeCommit: input.observed.preUpgradeCommit,
    upgradedCommit: input.observed.upgradedCommit,
    verifiedPaths: [...expected.keys()].sort(compareText),
  };
};
