import { createHash } from "node:crypto";

type Checksum = `sha256:${string}`;

export type AdoptionReceipt = {
  readonly schemaVersion: 1;
  readonly executionPlanDigest: string;
  readonly authorityFingerprint: string;
  readonly outcome: "completed" | "rolled-back";
  readonly phases: {
    readonly staged: readonly {
      readonly path: string;
      readonly expectedChecksum: string;
      readonly observedChecksum: string;
    }[];
    readonly verified: readonly {
      readonly path: string;
      readonly sourceChecksum: string;
      readonly observedSourceChecksum: string;
      readonly targetChecksum: string | null;
      readonly observedTargetChecksum: string | null;
    }[];
    readonly cutover: {
      readonly completedSteps: readonly string[];
      readonly readinessEvidence: readonly {
        readonly path: string;
        readonly checksum: string;
      }[];
    };
    readonly postCutoverDeletion: readonly {
      readonly path: string;
      readonly rollbackChecksum: string;
      readonly deletionConfirmed: true;
    }[];
  };
  readonly rollback: {
    readonly status: "available" | "exercised";
    readonly strategy: string;
    readonly evidencePath: string;
    readonly evidenceChecksum: string;
    readonly restoresSource: boolean;
  };
};

export type AdoptionReceiptFinding = {
  readonly code: string;
  readonly message: string;
  readonly repair: string;
};

export type AdoptionReceiptVerification = {
  readonly ok: boolean;
  readonly mutationPosture: "read-only";
  readonly findings: readonly AdoptionReceiptFinding[];
  readonly receiptDigest: string | null;
};

export type PlanOperation = {
  readonly path: string;
  readonly sourceChecksum: string;
  readonly stagedChecksum: string | null;
  readonly rollbackChecksum: string | null;
};

export type ParsedPlan = {
  readonly authorityFingerprint: string;
  readonly stage: readonly PlanOperation[];
  readonly verify: readonly PlanOperation[];
  readonly cutover: {
    readonly steps: readonly string[];
    readonly readinessEvidence: readonly string[];
  };
  readonly deletions: readonly PlanOperation[];
  readonly rollback: {
    readonly strategy: string;
    readonly evidence: string;
    readonly restoresSource: boolean;
  };
};

export const digest = (content: string): Checksum =>
  `sha256:${createHash("sha256").update(content).digest("hex")}`;

export const checksum = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const exact = (
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> =>
  record(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const validOperation = (value: unknown): value is PlanOperation =>
  record(value) &&
  typeof value.path === "string" &&
  checksum(value.sourceChecksum) &&
  (value.stagedChecksum === null || checksum(value.stagedChecksum)) &&
  (value.rollbackChecksum === null || checksum(value.rollbackChecksum));

export const parsePlan = (content: string): ParsedPlan | null => {
  try {
    const value: unknown = JSON.parse(content);
    if (!record(value) || !checksum(value.authorityFingerprint)) return null;
    if (!Array.isArray(value.phases) || value.phases.length !== 4) return null;
    const phases = new Map<string, Record<string, unknown>>();
    for (const phase of value.phases) {
      if (!record(phase) || typeof phase.name !== "string") return null;
      phases.set(phase.name, phase);
    }
    const stage = phases.get("stage");
    const verify = phases.get("verify");
    const cutover = phases.get("cutover");
    const deletion = phases.get("post-cutover-deletion");
    if (!stage || !verify || !cutover || !deletion || phases.size !== 4)
      return null;
    if (
      !Array.isArray(stage.operations) ||
      !stage.operations.every(validOperation) ||
      !Array.isArray(verify.operations) ||
      !verify.operations.every(validOperation) ||
      !Array.isArray(deletion.operations) ||
      !deletion.operations.every(validOperation) ||
      !stringArray(cutover.steps) ||
      !stringArray(cutover.readinessEvidence) ||
      !record(value.rollback) ||
      typeof value.rollback.strategy !== "string" ||
      typeof value.rollback.evidence !== "string" ||
      typeof value.rollback.restoresSource !== "boolean"
    )
      return null;
    return {
      authorityFingerprint: value.authorityFingerprint,
      stage: stage.operations,
      verify: verify.operations,
      cutover: {
        steps: cutover.steps,
        readinessEvidence: cutover.readinessEvidence,
      },
      deletions: deletion.operations,
      rollback: {
        strategy: value.rollback.strategy,
        evidence: value.rollback.evidence,
        restoresSource: value.rollback.restoresSource,
      },
    };
  } catch {
    return null;
  }
};

export const receiptShape = (value: unknown): value is AdoptionReceipt => {
  if (
    !exact(value, [
      "schemaVersion",
      "executionPlanDigest",
      "authorityFingerprint",
      "outcome",
      "phases",
      "rollback",
    ]) ||
    value.schemaVersion !== 1 ||
    !checksum(value.executionPlanDigest) ||
    !checksum(value.authorityFingerprint) ||
    !["completed", "rolled-back"].includes(String(value.outcome)) ||
    !exact(value.phases, [
      "staged",
      "verified",
      "cutover",
      "postCutoverDeletion",
    ]) ||
    !Array.isArray(value.phases.staged) ||
    !Array.isArray(value.phases.verified) ||
    !Array.isArray(value.phases.postCutoverDeletion) ||
    !exact(value.phases.cutover, ["completedSteps", "readinessEvidence"]) ||
    !stringArray(value.phases.cutover.completedSteps) ||
    !Array.isArray(value.phases.cutover.readinessEvidence) ||
    !exact(value.rollback, [
      "status",
      "strategy",
      "evidencePath",
      "evidenceChecksum",
      "restoresSource",
    ])
  )
    return false;
  const staged = value.phases.staged.every(
    (item) =>
      exact(item, ["path", "expectedChecksum", "observedChecksum"]) &&
      typeof item.path === "string" &&
      checksum(item.expectedChecksum) &&
      checksum(item.observedChecksum),
  );
  const verified = value.phases.verified.every(
    (item) =>
      exact(item, [
        "path",
        "sourceChecksum",
        "observedSourceChecksum",
        "targetChecksum",
        "observedTargetChecksum",
      ]) &&
      typeof item.path === "string" &&
      checksum(item.sourceChecksum) &&
      checksum(item.observedSourceChecksum) &&
      (item.targetChecksum === null || checksum(item.targetChecksum)) &&
      (item.observedTargetChecksum === null ||
        checksum(item.observedTargetChecksum)),
  );
  const readiness = value.phases.cutover.readinessEvidence.every(
    (item) =>
      exact(item, ["path", "checksum"]) &&
      typeof item.path === "string" &&
      checksum(item.checksum),
  );
  const deletions = value.phases.postCutoverDeletion.every(
    (item) =>
      exact(item, ["path", "rollbackChecksum", "deletionConfirmed"]) &&
      typeof item.path === "string" &&
      checksum(item.rollbackChecksum) &&
      item.deletionConfirmed === true,
  );
  return (
    staged &&
    verified &&
    readiness &&
    deletions &&
    ["available", "exercised"].includes(String(value.rollback.status)) &&
    typeof value.rollback.strategy === "string" &&
    typeof value.rollback.evidencePath === "string" &&
    checksum(value.rollback.evidenceChecksum) &&
    typeof value.rollback.restoresSource === "boolean"
  );
};

export const exactPaths = (
  expected: readonly PlanOperation[],
  actual: readonly { readonly path: string }[],
): boolean => {
  const paths = actual.map(({ path }) => path);
  return (
    new Set(paths).size === paths.length &&
    paths.length === expected.length &&
    expected.every(({ path }) => paths.includes(path))
  );
};

export const sameStrings = (
  left: readonly string[],
  right: readonly string[],
) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export { verifyAdoptionReceipt } from "./adoptReceiptVerifier.js";
