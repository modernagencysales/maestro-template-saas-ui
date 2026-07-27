import { createHash } from "node:crypto";
import type { AdoptionExecutionResult } from "./adoptExecution.js";
import {
  checksum,
  receiptShape,
  type AdoptionReceipt,
} from "./adoptReceipt.js";
import { verifyAdoptionReceipt } from "./adoptReceiptVerifier.js";

export type AdoptionCutoverIdentity = {
  readonly adoptionId: string;
  readonly targetInstanceId: string;
  readonly targetRevision: string;
  readonly approvalEvidence: string;
};

export type AdoptionCheckpointInput = {
  readonly executionPlan: NonNullable<AdoptionExecutionResult["artifact"]>;
  readonly reviewedExecutionPlanDigest: string;
  readonly authorityFingerprint: string;
  readonly receipt: unknown;
  readonly cutoverIdentity: AdoptionCutoverIdentity;
  readonly reviewedCutoverIdentity: AdoptionCutoverIdentity;
  readonly acceptedReceiptDigests: readonly string[];
};

export type AdoptionCheckpointFinding = {
  readonly code: string;
  readonly message: string;
  readonly repair: string;
};

export type AdoptionCheckpointResult = {
  readonly ok: boolean;
  readonly mutationPosture: "dry-run";
  readonly findings: readonly AdoptionCheckpointFinding[];
  readonly artifact: {
    readonly path: string;
    readonly content: string;
    readonly digest: string;
  } | null;
};

type PlanIdentity = {
  readonly adoptionId: string;
  readonly workPackageDigest: string;
  readonly approvalEvidence: string;
};

const hash = (content: string): string =>
  `sha256:${createHash("sha256").update(content).digest("hex")}`;

const finding = (
  code: string,
  message: string,
  repair: string,
): AdoptionCheckpointFinding => ({ code, message, repair });

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const parsePlanIdentity = (content: string): PlanIdentity | null => {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !record(value) ||
      typeof value.id !== "string" ||
      !value.id.endsWith("-execution") ||
      !checksum(value.workPackageDigest) ||
      typeof value.approvalEvidence !== "string" ||
      value.approvalEvidence.length === 0
    )
      return null;
    return {
      adoptionId: value.id.slice(0, -"-execution".length),
      workPackageDigest: value.workPackageDigest,
      approvalEvidence: value.approvalEvidence,
    };
  } catch {
    return null;
  }
};

const validId = (value: string): boolean =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

const validIdentityShape = (value: AdoptionCutoverIdentity): boolean => {
  const keys = [
    "adoptionId",
    "targetInstanceId",
    "targetRevision",
    "approvalEvidence",
  ];
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
};

const sameIdentity = (
  left: AdoptionCutoverIdentity,
  right: AdoptionCutoverIdentity,
): boolean =>
  left.adoptionId === right.adoptionId &&
  left.targetInstanceId === right.targetInstanceId &&
  left.targetRevision === right.targetRevision &&
  left.approvalEvidence === right.approvalEvidence;

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([left], [right]) =>
              left < right ? -1 : left > right ? 1 : 0,
            )
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;

export const compileAdoptionCheckpoint = (
  input: AdoptionCheckpointInput,
): AdoptionCheckpointResult => {
  const findings: AdoptionCheckpointFinding[] = [];
  const verification = verifyAdoptionReceipt({
    executionPlan: input.executionPlan,
    reviewedExecutionPlanDigest: input.reviewedExecutionPlanDigest,
    authorityFingerprint: input.authorityFingerprint,
    receipt: input.receipt,
  });
  for (const receiptFinding of verification.findings) {
    if (receiptFinding.code === "ADOPTION_RECEIPT_PLAN_INVALID")
      findings.push(
        finding(
          "ADOPTION_CHECKPOINT_PLAN_DRIFT",
          "The execution plan is no longer the reviewed plan.",
          "Use the exact reviewed execution-plan bytes and digest.",
        ),
      );
    else if (receiptFinding.code === "ADOPTION_RECEIPT_AUTHORITY_MISMATCH")
      findings.push(
        finding(
          "ADOPTION_CHECKPOINT_STALE",
          "The receipt is stale for the current launch authority.",
          "Re-run authority validation and adoption under a new plan.",
        ),
      );
    else
      findings.push(
        finding(
          "ADOPTION_CHECKPOINT_RECEIPT_DRIFT",
          "Receipt evidence differs from the reviewed execution plan.",
          "Repair or replace the receipt; never infer missing phase evidence.",
        ),
      );
  }
  const receipt = receiptShape(input.receipt) ? input.receipt : null;
  if (receipt?.outcome === "rolled-back")
    findings.push(
      finding(
        "ADOPTION_CHECKPOINT_OUTCOME_REJECTED",
        "A rolled-back adoption cannot become an accepted checkpoint.",
        "Preserve the rollback receipt and complete a new reviewed adoption.",
      ),
    );

  const identity = parsePlanIdentity(input.executionPlan.content);
  if (
    identity === null ||
    !validIdentityShape(input.cutoverIdentity) ||
    !validIdentityShape(input.reviewedCutoverIdentity) ||
    !validId(input.cutoverIdentity.adoptionId) ||
    !validId(input.cutoverIdentity.targetInstanceId) ||
    !checksum(input.cutoverIdentity.targetRevision) ||
    !sameIdentity(input.cutoverIdentity, input.reviewedCutoverIdentity) ||
    input.cutoverIdentity.adoptionId !== identity.adoptionId ||
    input.cutoverIdentity.approvalEvidence !== identity.approvalEvidence
  )
    findings.push(
      finding(
        "ADOPTION_CHECKPOINT_CUTOVER_IDENTITY_INVALID",
        "Cutover identity is unreviewed or does not match the execution plan.",
        "Supply the exact reviewed adoption, target, revision, and approval identity.",
      ),
    );

  const receiptDigest = verification.receiptDigest;
  if (
    receiptDigest !== null &&
    input.acceptedReceiptDigests.includes(receiptDigest)
  )
    findings.push(
      finding(
        "ADOPTION_CHECKPOINT_RECEIPT_REPLAYED",
        "This verified receipt already produced an accepted checkpoint.",
        "Keep the existing checkpoint; a new adoption requires a new receipt.",
      ),
    );
  if (
    new Set(input.acceptedReceiptDigests).size !==
      input.acceptedReceiptDigests.length ||
    input.acceptedReceiptDigests.some((value) => !checksum(value))
  )
    findings.push(
      finding(
        "ADOPTION_CHECKPOINT_REPLAY_LEDGER_INVALID",
        "The accepted-receipt ledger is malformed or ambiguous.",
        "Supply unique exact receipt digests from the accepted checkpoint store.",
      ),
    );

  if (
    findings.length > 0 ||
    receipt === null ||
    receiptDigest === null ||
    identity === null
  )
    return { ok: false, mutationPosture: "dry-run", findings, artifact: null };

  const packet = {
    schemaVersion: 1,
    checkpointId: hash(
      `${input.reviewedExecutionPlanDigest}\n${receiptDigest}\n${input.cutoverIdentity.targetRevision}`,
    ),
    adoptionId: identity.adoptionId,
    workPackageDigest: identity.workPackageDigest,
    executionPlanDigest: input.reviewedExecutionPlanDigest,
    authorityFingerprint: input.authorityFingerprint,
    receiptDigest,
    cutoverIdentity: input.cutoverIdentity,
    rollback: (receipt as AdoptionReceipt).rollback,
    acceptance: "accepted" as const,
  };
  const content = `${JSON.stringify(canonical(packet), null, 2)}\n`;
  return {
    ok: true,
    mutationPosture: "dry-run",
    findings: [],
    artifact: {
      path: `adoption/${identity.adoptionId}.accepted-checkpoint.json`,
      content,
      digest: hash(content),
    },
  };
};
