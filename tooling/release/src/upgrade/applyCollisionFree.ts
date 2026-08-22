import { planUpgrade } from "./plan.js";

export type CollisionFreeApplyCode =
  | "UPGRADE_APPLY_INPUT_INVALID"
  | "UPGRADE_APPLY_PLAN_BLOCKED"
  | "UPGRADE_APPLY_WRITE_REQUIRED"
  | "UPGRADE_APPLY_STALE_PLAN"
  | "UPGRADE_APPLY_TARGET_DIRTY"
  | "UPGRADE_APPLY_PRE_COMMIT_MISMATCH"
  | "UPGRADE_APPLY_STAGING_INCOMPLETE"
  | "UPGRADE_APPLY_BEFORE_MISMATCH"
  | "UPGRADE_APPLY_AFTER_MISMATCH";

export type CollisionFreeApplyResolution = {
  readonly code: CollisionFreeApplyCode;
  readonly path?: string;
  readonly message: string;
  readonly repair: string;
  readonly planCodes?: readonly string[];
};

export type CollisionFreeApplyResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "apply-safe-preparation";
      readonly promotionReady: true;
      readonly applied: false;
      readonly writePerformed: false;
      readonly executionAvailable: false;
      readonly planFingerprint: string;
      readonly manifestFingerprint: string;
      readonly preUpgradeCommit: string;
      readonly verifiedPaths: readonly string[];
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "apply-safe-preparation";
      readonly promotionReady: false;
      readonly applied: false;
      readonly writePerformed: false;
      readonly executionAvailable: false;
      readonly resolutions: readonly CollisionFreeApplyResolution[];
    };

type PathEvidence =
  | { readonly path: string; readonly state: "absent" }
  | { readonly path: string; readonly state: "present"; readonly hash: string };

type ParsedApply = {
  readonly planInput: unknown;
  readonly expectedPlanFingerprint: string;
  readonly write: boolean;
  readonly staging: {
    readonly status: "complete" | "interrupted" | "failed";
    readonly preUpgradeCommit: string;
    readonly targetClean: boolean;
    readonly beforePaths: readonly PathEvidence[];
    readonly afterPaths: readonly PathEvidence[];
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
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
const commit = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
const safePath = (value: unknown): value is string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value !== value.normalize("NFC") ||
    value.startsWith("/") ||
    value.includes("\\")
  )
    return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    )
      return false;
  }
  return value
    .split("/")
    .every((part) => part.length > 0 && part !== "." && part !== "..");
};

const readPaths = (value: unknown): readonly PathEvidence[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const paths = value.map((entry): PathEvidence | undefined => {
    if (
      !isRecord(entry) ||
      !safePath(entry.path) ||
      (entry.state !== "present" && entry.state !== "absent")
    )
      return undefined;
    if (entry.state === "absent")
      return onlyKeys(entry, ["path", "state"])
        ? { path: entry.path, state: "absent" }
        : undefined;
    return onlyKeys(entry, ["path", "state", "hash"]) && digest(entry.hash)
      ? { path: entry.path, state: "present", hash: entry.hash }
      : undefined;
  });
  if (
    paths.some((entry) => entry === undefined) ||
    new Set(paths.map((entry) => entry?.path)).size !== paths.length
  )
    return undefined;
  return paths as readonly PathEvidence[];
};

const parseApply = (value: unknown): ParsedApply | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "schemaVersion",
      "planInput",
      "expectedPlanFingerprint",
      "write",
      "staging",
    ]) ||
    value.schemaVersion !== 1 ||
    !("planInput" in value) ||
    !digest(value.expectedPlanFingerprint) ||
    typeof value.write !== "boolean" ||
    !isRecord(value.staging) ||
    !onlyKeys(value.staging, [
      "status",
      "preUpgradeCommit",
      "targetClean",
      "beforePaths",
      "afterPaths",
    ]) ||
    !["complete", "interrupted", "failed"].includes(
      String(value.staging.status),
    ) ||
    !commit(value.staging.preUpgradeCommit) ||
    typeof value.staging.targetClean !== "boolean"
  )
    return undefined;
  const beforePaths = readPaths(value.staging.beforePaths);
  const afterPaths = readPaths(value.staging.afterPaths);
  if (!beforePaths || !afterPaths) return undefined;
  return {
    planInput: value.planInput,
    expectedPlanFingerprint: value.expectedPlanFingerprint,
    write: value.write,
    staging: {
      status: value.staging.status as ParsedApply["staging"]["status"],
      preUpgradeCommit: value.staging.preUpgradeCommit,
      targetClean: value.staging.targetClean,
      beforePaths,
      afterPaths,
    },
  };
};

const resolution = (
  code: CollisionFreeApplyCode,
  message: string,
  repair: string,
  options?: { readonly path?: string; readonly planCodes?: readonly string[] },
): CollisionFreeApplyResolution => ({
  code,
  ...(options?.path ? { path: options.path } : {}),
  message,
  repair,
  ...(options?.planCodes ? { planCodes: [...options.planCodes] } : {}),
});

const failed = (
  resolutions: readonly CollisionFreeApplyResolution[],
): CollisionFreeApplyResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "apply-safe-preparation",
  promotionReady: false,
  applied: false,
  writePerformed: false,
  executionAvailable: false,
  resolutions: [...resolutions].sort((left, right) => {
    const code = compareText(left.code, right.code);
    return code === 0 ? compareText(left.path ?? "", right.path ?? "") : code;
  }),
});

const compareEvidence = (
  expected: ReadonlyMap<string, PathEvidence>,
  observed: readonly PathEvidence[],
  code: "UPGRADE_APPLY_BEFORE_MISMATCH" | "UPGRADE_APPLY_AFTER_MISMATCH",
): CollisionFreeApplyResolution[] => {
  const actual = new Map(observed.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...expected.keys(), ...actual.keys()])].sort(
    compareText,
  );
  return paths.flatMap((path) => {
    const wanted = expected.get(path);
    const found = actual.get(path);
    if (
      wanted &&
      found &&
      wanted.state === found.state &&
      (wanted.state === "absent" ||
        (found.state === "present" && wanted.hash === found.hash))
    )
      return [];
    return [
      resolution(
        code,
        `Staged ${code === "UPGRADE_APPLY_BEFORE_MISMATCH" ? "before" : "after"}-state evidence does not match the reviewed operation at "${path}".`,
        "Discard the staging result and rebuild it from the exact clean reviewed target.",
        { path },
      ),
    ];
  });
};

export const prepareCollisionFreeApply = (
  candidate: unknown,
): CollisionFreeApplyResult => {
  const input = parseApply(candidate);
  if (!input)
    return failed([
      resolution(
        "UPGRADE_APPLY_INPUT_INVALID",
        "Apply preparation input does not match the closed V1 contract.",
        "Rebuild the request from the reviewed plan and injected staging evidence.",
      ),
    ]);

  const plan = planUpgrade(input.planInput);
  if (!plan.ok)
    return failed([
      resolution(
        "UPGRADE_APPLY_PLAN_BLOCKED",
        "The source upgrade plan is not collision-free.",
        "Resolve every plan finding before requesting apply-safe preparation.",
        { planCodes: plan.resolutions.map(({ code }) => code) },
      ),
    ]);

  const resolutions: CollisionFreeApplyResolution[] = [];
  if (!input.write)
    resolutions.push(
      resolution(
        "UPGRADE_APPLY_WRITE_REQUIRED",
        "Apply-safe preparation requires explicit write intent.",
        "Re-run with the explicit write flag after reviewing the exact plan.",
      ),
    );
  if (input.expectedPlanFingerprint !== plan.planFingerprint)
    resolutions.push(
      resolution(
        "UPGRADE_APPLY_STALE_PLAN",
        "The supplied plan fingerprint is stale or tampered.",
        "Regenerate and review the plan for the current committed target.",
      ),
    );
  if (!input.staging.targetClean)
    resolutions.push(
      resolution(
        "UPGRADE_APPLY_TARGET_DIRTY",
        "The target changed or became dirty during staging.",
        "Restore a clean committed target and rebuild the staged result.",
      ),
    );
  if (input.staging.preUpgradeCommit !== plan.targetCommit)
    resolutions.push(
      resolution(
        "UPGRADE_APPLY_PRE_COMMIT_MISMATCH",
        "The staging base is not the reviewed pre-upgrade commit.",
        "Stage again from the exact commit recorded by the plan.",
      ),
    );
  if (input.staging.status !== "complete")
    resolutions.push(
      resolution(
        "UPGRADE_APPLY_STAGING_INCOMPLETE",
        `Staging ended with status "${input.staging.status}".`,
        "Discard all staged output and restart from the pre-upgrade commit.",
      ),
    );

  const expectedBefore = new Map<string, PathEvidence>();
  const expectedAfter = new Map<string, PathEvidence>();
  for (const entry of plan.diff) {
    if (entry.kind === "add") {
      expectedBefore.set(entry.path, { path: entry.path, state: "absent" });
    } else {
      const source = entry.fromPath ?? entry.path;
      expectedBefore.set(source, {
        path: source,
        state: "present",
        hash: entry.beforeHash ?? "",
      });
      if (entry.kind === "move")
        expectedBefore.set(entry.path, { path: entry.path, state: "absent" });
    }

    if (entry.kind === "delete") {
      expectedAfter.set(entry.path, { path: entry.path, state: "absent" });
    } else {
      if (entry.kind === "move" && entry.fromPath)
        expectedAfter.set(entry.fromPath, {
          path: entry.fromPath,
          state: "absent",
        });
      expectedAfter.set(entry.path, {
        path: entry.path,
        state: "present",
        hash: entry.afterHash ?? "",
      });
    }
  }
  resolutions.push(
    ...compareEvidence(
      expectedBefore,
      input.staging.beforePaths,
      "UPGRADE_APPLY_BEFORE_MISMATCH",
    ),
    ...compareEvidence(
      expectedAfter,
      input.staging.afterPaths,
      "UPGRADE_APPLY_AFTER_MISMATCH",
    ),
  );
  if (resolutions.length > 0) return failed(resolutions);

  return {
    ok: true,
    schemaVersion: 1,
    mode: "apply-safe-preparation",
    promotionReady: true,
    applied: false,
    writePerformed: false,
    executionAvailable: false,
    planFingerprint: plan.planFingerprint,
    manifestFingerprint: plan.manifestFingerprint,
    preUpgradeCommit: plan.targetCommit,
    verifiedPaths: [...expectedAfter.keys()].sort(compareText),
  };
};
