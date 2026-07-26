import { createHash } from "node:crypto";

import {
  parsePromotionVerdict,
  PromotionVerdictContractError,
  type PromotionApproverClass,
  type PromotionCompatibility,
  type PromotionEvidenceClass,
  type PromotionEvidenceFingerprint,
  type PromotionWorkflowCensus,
} from "./contract.js";
import {
  hashPromotionVerdictPayload,
  promotionVerdictPayload,
} from "./verdict.js";
import {
  verifyPromotionDecisionReceipt,
  type PromotionDecisionReceipt,
} from "./decision.js";
import type { PromotionReplayObservation } from "./audit.js";

export const MAX_PROMOTION_CHECKPOINT_DELAY_MS = 5_000;

export type AcceptedPromotionCheckpointPayload = {
  readonly schemaVersion: 1;
  readonly kind: "accepted-promotion-checkpoint";
  readonly mode: "record-only";
  readonly status: "accepted";
  readonly transition: string;
  readonly fromEnvironment: string;
  readonly toEnvironment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly compatibility: readonly PromotionCompatibility[];
  readonly evidence: readonly PromotionEvidenceFingerprint[];
  readonly workflowCensus: PromotionWorkflowCensus;
  readonly approverClass: PromotionApproverClass;
  readonly authority: {
    readonly jobId: string;
    readonly leaseId: string;
    readonly credentialScopes: readonly string[];
    readonly credentialSetFingerprint: string;
  };
  readonly sources: {
    readonly verdictHash: string;
    readonly verdictNonce: string;
    readonly decisionReceiptHash: string;
    readonly leaseNonce: string;
    readonly auditObservationHash: string;
  };
  readonly acceptedAt: number;
  readonly compiledAt: number;
  readonly expiresAt: number;
};

export type AcceptedPromotionCheckpoint = AcceptedPromotionCheckpointPayload & {
  readonly canonicalHash: string;
};

export type PromotionCheckpointFindingCode =
  | "invalid-receipt"
  | "invalid-verdict"
  | "invalid-audit-observation"
  | "stale-input"
  | "audit-window-mismatch"
  | "source-binding-mismatch";

export type PromotionCheckpointResult =
  | {
      readonly kind: "compiled";
      readonly checkpoint: AcceptedPromotionCheckpoint;
    }
  | {
      readonly kind: "blocked";
      readonly findings: readonly {
        readonly code: PromotionCheckpointFindingCode;
        readonly detail: string;
      }[];
    };

export type CompileAcceptedPromotionCheckpointInput = {
  readonly receipt: unknown;
  readonly trustedReceipt: PromotionDecisionReceipt;
  readonly verdict: unknown;
  readonly auditObservation: unknown;
};

export type PromotionCheckpointDependencies = {
  readonly nowMs: () => number;
};

export type PromotionCheckpointVerification =
  | { readonly ok: true; readonly checkpoint: AcceptedPromotionCheckpoint }
  | {
      readonly ok: false;
      readonly code: "invalid-checkpoint" | "tampered" | "stale" | "mismatch";
    };

const evidenceClassOrder: readonly PromotionEvidenceClass[] = [
  "artifact-provenance",
  "build-verification",
  "compatibility-verification",
  "privacy-verification",
  "runtime-verification",
  "security-verification",
];

export const compileAcceptedPromotionCheckpoint = (
  input: CompileAcceptedPromotionCheckpointInput,
  dependencies: PromotionCheckpointDependencies,
): PromotionCheckpointResult => {
  const now = dependencies.nowMs();
  if (!isTime(now)) {
    return blocked("stale-input", "Checkpoint compilation clock is invalid.");
  }
  const receiptResult = verifyPromotionDecisionReceipt(
    input.receipt,
    input.trustedReceipt,
    now,
  );
  if (!receiptResult.ok) {
    return blocked(
      receiptResult.code === "stale" ? "stale-input" : "invalid-receipt",
      `Promotion decision receipt failed: ${receiptResult.code}.`,
    );
  }
  const receipt = receiptResult.receipt;
  let verdict: ReturnType<typeof parsePromotionVerdict>;
  try {
    verdict = parsePromotionVerdict(input.verdict);
  } catch (error) {
    return blocked(
      "invalid-verdict",
      error instanceof PromotionVerdictContractError
        ? error.message
        : "Promotion verdict parsing failed closed.",
    );
  }
  if (
    hashPromotionVerdictPayload(promotionVerdictPayload(verdict)) !==
    verdict.canonicalHash
  ) {
    return blocked("invalid-verdict", "Promotion verdict hash is invalid.");
  }
  if (now < verdict.issuedAt || now >= verdict.expiresAt) {
    return blocked(
      "stale-input",
      "Promotion verdict is outside its validity window.",
    );
  }
  const observation = parseAuditObservation(input.auditObservation);
  if (observation === undefined) {
    return blocked(
      "invalid-audit-observation",
      "Replay-audit observation has an invalid or open shape.",
    );
  }
  if (
    observation.consumedAt < receipt.decidedAt ||
    observation.consumedAt > now ||
    now - observation.consumedAt > MAX_PROMOTION_CHECKPOINT_DELAY_MS
  ) {
    return blocked(
      "audit-window-mismatch",
      "Replay-audit observation is future-dated, predates the decision, or is too old.",
    );
  }
  const bindingFindings = sourceBindingFindings(receipt, verdict, observation);
  if (bindingFindings.length > 0) {
    return {
      kind: "blocked",
      findings: Object.freeze(
        bindingFindings.map((detail) =>
          Object.freeze({
            code: "source-binding-mismatch" as const,
            detail,
          }),
        ),
      ),
    };
  }
  const payload: AcceptedPromotionCheckpointPayload = {
    schemaVersion: 1,
    kind: "accepted-promotion-checkpoint",
    mode: "record-only",
    status: "accepted",
    transition: receipt.transition,
    fromEnvironment: receipt.fromEnvironment,
    toEnvironment: receipt.toEnvironment,
    targetId: receipt.targetId,
    commitSha: receipt.commitSha,
    artifactHash: receipt.artifactHash,
    compatibility: Object.freeze(
      verdict.compatibility.map((entry) => Object.freeze({ ...entry })),
    ),
    evidence: Object.freeze(
      receipt.evidence.map((entry) => Object.freeze({ ...entry })),
    ),
    workflowCensus: Object.freeze({ ...receipt.workflowCensus }),
    approverClass: receipt.approverClass,
    authority: Object.freeze({
      jobId: receipt.authority.jobId,
      leaseId: receipt.authority.leaseId,
      credentialScopes: Object.freeze([...receipt.authority.credentialScopes]),
      credentialSetFingerprint: receipt.authority.credentialSetFingerprint,
    }),
    sources: Object.freeze({
      verdictHash: verdict.canonicalHash,
      verdictNonce: verdict.nonce,
      decisionReceiptHash: receipt.canonicalHash,
      leaseNonce: receipt.authority.leaseNonce,
      auditObservationHash: sha256(canonicalJson(observation)),
    }),
    acceptedAt: observation.consumedAt,
    compiledAt: now,
    expiresAt: Math.min(receipt.expiresAt, verdict.expiresAt),
  };
  if (payload.expiresAt <= now) {
    return blocked(
      "stale-input",
      "Accepted promotion checkpoint is already stale.",
    );
  }
  const checkpoint = Object.freeze({
    ...payload,
    canonicalHash: hashAcceptedPromotionCheckpointPayload(payload),
  });
  return Object.freeze({ kind: "compiled", checkpoint });
};

export const verifyAcceptedPromotionCheckpoint = (
  input: unknown,
  expected: AcceptedPromotionCheckpoint,
  nowMs: number,
): PromotionCheckpointVerification => {
  if (!isCheckpoint(input) || !isTime(nowMs)) {
    return { ok: false, code: "invalid-checkpoint" };
  }
  const checkpoint = freezeCheckpoint(input);
  if (
    hashAcceptedPromotionCheckpointPayload(checkpointPayload(checkpoint)) !==
    checkpoint.canonicalHash
  ) {
    return { ok: false, code: "tampered" };
  }
  if (nowMs < checkpoint.compiledAt || nowMs >= checkpoint.expiresAt) {
    return { ok: false, code: "stale" };
  }
  if (canonicalJson(checkpoint) !== canonicalJson(expected)) {
    return { ok: false, code: "mismatch" };
  }
  return { ok: true, checkpoint };
};

export const hashAcceptedPromotionCheckpointPayload = (
  payload: AcceptedPromotionCheckpointPayload,
): string => sha256(canonicalJson(payload));

const sourceBindingFindings = (
  receipt: PromotionDecisionReceipt,
  verdict: ReturnType<typeof parsePromotionVerdict>,
  observation: PromotionReplayObservation,
): string[] => {
  const findings: string[] = [];
  for (const [label, left, right] of [
    ["from environment", verdict.fromEnvironment, receipt.fromEnvironment],
    ["to environment", verdict.toEnvironment, receipt.toEnvironment],
    ["target", verdict.targetId, receipt.targetId],
    ["commit", verdict.commitSha, receipt.commitSha],
    ["artifact", verdict.artifactHash, receipt.artifactHash],
    ["approver", verdict.approverClass, receipt.approverClass],
    ["verdict hash", verdict.canonicalHash, receipt.verdictHash],
    ["verdict nonce", verdict.nonce, receipt.verdictNonce],
    ["audit receipt hash", observation.receiptHash, receipt.canonicalHash],
    ["audit verdict nonce", observation.verdictNonce, receipt.verdictNonce],
    ["audit lease nonce", observation.leaseNonce, receipt.authority.leaseNonce],
    [
      "audit from environment",
      observation.fromEnvironment,
      receipt.fromEnvironment,
    ],
    ["audit to environment", observation.toEnvironment, receipt.toEnvironment],
    ["audit target", observation.targetId, receipt.targetId],
    ["audit commit", observation.commitSha, receipt.commitSha],
    ["audit artifact", observation.artifactHash, receipt.artifactHash],
  ] as const) {
    if (left !== right)
      findings.push(`${label} does not match across accepted sources.`);
  }
  if (canonicalJson(verdict.evidence) !== canonicalJson(receipt.evidence)) {
    findings.push("Verdict evidence does not match decision receipt evidence.");
  }
  if (
    canonicalJson(verdict.workflowCensus) !==
    canonicalJson(receipt.workflowCensus)
  ) {
    findings.push("Verdict census does not match decision receipt census.");
  }
  return findings;
};

const parseAuditObservation = (
  input: unknown,
): PromotionReplayObservation | undefined => {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "schemaVersion",
      "kind",
      "receiptHash",
      "verdictNonce",
      "leaseNonce",
      "fromEnvironment",
      "toEnvironment",
      "targetId",
      "commitSha",
      "artifactHash",
      "consumedAt",
    ]) ||
    input.schemaVersion !== 1 ||
    input.kind !== "promotion-decision-consumption" ||
    !isSha256(input.receiptHash) ||
    !isNonce(input.verdictNonce) ||
    !isNonce(input.leaseNonce) ||
    input.verdictNonce === input.leaseNonce ||
    typeof input.fromEnvironment !== "string" ||
    (input.toEnvironment !== "staging" &&
      input.toEnvironment !== "production") ||
    typeof input.targetId !== "string" ||
    !isCommit(input.commitSha) ||
    !isSha256(input.artifactHash) ||
    !isTime(input.consumedAt)
  ) {
    return undefined;
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: "promotion-decision-consumption",
    receiptHash: input.receiptHash,
    verdictNonce: input.verdictNonce,
    leaseNonce: input.leaseNonce,
    fromEnvironment: input.fromEnvironment,
    toEnvironment: input.toEnvironment,
    targetId: input.targetId,
    commitSha: input.commitSha,
    artifactHash: input.artifactHash,
    consumedAt: input.consumedAt,
  });
};

const checkpointPayload = (
  checkpoint: AcceptedPromotionCheckpoint,
): AcceptedPromotionCheckpointPayload => ({
  schemaVersion: checkpoint.schemaVersion,
  kind: checkpoint.kind,
  mode: checkpoint.mode,
  status: checkpoint.status,
  transition: checkpoint.transition,
  fromEnvironment: checkpoint.fromEnvironment,
  toEnvironment: checkpoint.toEnvironment,
  targetId: checkpoint.targetId,
  commitSha: checkpoint.commitSha,
  artifactHash: checkpoint.artifactHash,
  compatibility: checkpoint.compatibility,
  evidence: checkpoint.evidence,
  workflowCensus: checkpoint.workflowCensus,
  approverClass: checkpoint.approverClass,
  authority: checkpoint.authority,
  sources: checkpoint.sources,
  acceptedAt: checkpoint.acceptedAt,
  compiledAt: checkpoint.compiledAt,
  expiresAt: checkpoint.expiresAt,
});

const isCheckpoint = (input: unknown): input is AcceptedPromotionCheckpoint => {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "schemaVersion",
      "kind",
      "mode",
      "status",
      "transition",
      "fromEnvironment",
      "toEnvironment",
      "targetId",
      "commitSha",
      "artifactHash",
      "compatibility",
      "evidence",
      "workflowCensus",
      "approverClass",
      "authority",
      "sources",
      "acceptedAt",
      "compiledAt",
      "expiresAt",
      "canonicalHash",
    ]) ||
    input.schemaVersion !== 1 ||
    input.kind !== "accepted-promotion-checkpoint" ||
    input.mode !== "record-only" ||
    input.status !== "accepted" ||
    typeof input.transition !== "string" ||
    !isEnvironmentId(input.fromEnvironment) ||
    (input.toEnvironment !== "staging" &&
      input.toEnvironment !== "production") ||
    input.transition !== `${input.fromEnvironment}->${input.toEnvironment}` ||
    !isEnvironmentId(input.targetId) ||
    !isCommit(input.commitSha) ||
    !isSha256(input.artifactHash) ||
    !isCompatibility(input.compatibility) ||
    !isEvidence(input.evidence) ||
    !isCensus(input.workflowCensus) ||
    !isApprover(input.approverClass) ||
    !isAuthority(input.authority) ||
    !isSources(input.sources) ||
    !isTime(input.acceptedAt) ||
    !isTime(input.compiledAt) ||
    !isTime(input.expiresAt) ||
    input.acceptedAt > input.compiledAt ||
    input.compiledAt >= input.expiresAt ||
    !isSha256(input.canonicalHash)
  ) {
    return false;
  }
  return true;
};

const isCompatibility = (
  input: unknown,
): input is readonly PromotionCompatibility[] => {
  if (!Array.isArray(input) || input.length === 0) return false;
  const components: string[] = [];
  for (const entry of input) {
    if (
      !isRecord(entry) ||
      !hasExactKeys(entry, ["component", "version"]) ||
      !isEnvironmentId(entry.component) ||
      typeof entry.version !== "string" ||
      entry.version.length === 0 ||
      entry.version.length > 128
    ) {
      return false;
    }
    components.push(entry.component);
  }
  return isCanonicalUnique(components);
};

const isEvidence = (
  input: unknown,
): input is readonly PromotionEvidenceFingerprint[] => {
  if (!Array.isArray(input) || input.length === 0) return false;
  const classes: PromotionEvidenceClass[] = [];
  for (const entry of input) {
    if (
      !isRecord(entry) ||
      !hasExactKeys(entry, ["class", "fingerprint"]) ||
      !evidenceClassOrder.includes(entry.class as PromotionEvidenceClass) ||
      !isSha256(entry.fingerprint)
    ) {
      return false;
    }
    classes.push(entry.class as PromotionEvidenceClass);
  }
  return (
    new Set(classes).size === classes.length &&
    classes.every(
      (value, index) =>
        value ===
        evidenceClassOrder.filter((entry) => classes.includes(entry))[index],
    )
  );
};

const isCensus = (input: unknown): input is PromotionWorkflowCensus =>
  isRecord(input) &&
  hasExactKeys(input, ["capturedAt", "active", "restartable", "fingerprint"]) &&
  isTime(input.capturedAt) &&
  isTime(input.active) &&
  isTime(input.restartable) &&
  isSha256(input.fingerprint);

const isAuthority = (
  input: unknown,
): input is AcceptedPromotionCheckpointPayload["authority"] =>
  isRecord(input) &&
  hasExactKeys(input, [
    "jobId",
    "leaseId",
    "credentialScopes",
    "credentialSetFingerprint",
  ]) &&
  typeof input.jobId === "string" &&
  input.jobId.length > 0 &&
  typeof input.leaseId === "string" &&
  input.leaseId.length > 0 &&
  Array.isArray(input.credentialScopes) &&
  input.credentialScopes.length > 0 &&
  input.credentialScopes.every(
    (value) =>
      typeof value === "string" &&
      /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(value),
  ) &&
  isCanonicalUnique(input.credentialScopes as string[]) &&
  isSha256(input.credentialSetFingerprint);

const isSources = (
  input: unknown,
): input is AcceptedPromotionCheckpointPayload["sources"] =>
  isRecord(input) &&
  hasExactKeys(input, [
    "verdictHash",
    "verdictNonce",
    "decisionReceiptHash",
    "leaseNonce",
    "auditObservationHash",
  ]) &&
  isSha256(input.verdictHash) &&
  isNonce(input.verdictNonce) &&
  isSha256(input.decisionReceiptHash) &&
  isNonce(input.leaseNonce) &&
  input.verdictNonce !== input.leaseNonce &&
  isSha256(input.auditObservationHash);

const freezeCheckpoint = (
  checkpoint: AcceptedPromotionCheckpoint,
): AcceptedPromotionCheckpoint =>
  Object.freeze({
    ...checkpoint,
    compatibility: Object.freeze(
      checkpoint.compatibility.map((entry) => Object.freeze({ ...entry })),
    ),
    evidence: Object.freeze(
      checkpoint.evidence.map((entry) => Object.freeze({ ...entry })),
    ),
    workflowCensus: Object.freeze({ ...checkpoint.workflowCensus }),
    authority: Object.freeze({
      ...checkpoint.authority,
      credentialScopes: Object.freeze([
        ...checkpoint.authority.credentialScopes,
      ]),
    }),
    sources: Object.freeze({ ...checkpoint.sources }),
  });

const isApprover = (input: unknown): input is PromotionApproverClass =>
  input === "release-controller" ||
  input === "security-controller" ||
  input === "emergency-controller";

const isCanonicalUnique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length &&
  values.every(
    (value, index) =>
      index === 0 || compareAscii(values[index - 1] ?? "", value) < 0,
  );

const blocked = (
  code: PromotionCheckpointFindingCode,
  detail: string,
): PromotionCheckpointResult =>
  Object.freeze({
    kind: "blocked",
    findings: Object.freeze([Object.freeze({ code, detail })]),
  });

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const hasExactKeys = (
  input: Record<string, unknown>,
  keys: readonly string[],
): boolean =>
  Object.keys(input).length === keys.length &&
  keys.every((key) => Object.hasOwn(input, key));

const isSha256 = (input: unknown): input is string =>
  typeof input === "string" && /^sha256:[0-9a-f]{64}$/.test(input);

const isNonce = (input: unknown): input is string =>
  typeof input === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(input);

const isCommit = (input: unknown): input is string =>
  typeof input === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(input);

const isEnvironmentId = (input: unknown): input is string =>
  typeof input === "string" && /^[a-z][a-z0-9-]{0,62}$/.test(input);

const isTime = (input: unknown): input is number =>
  Number.isSafeInteger(input) && (input as number) >= 0;

const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

const canonicalJson = (value: CanonicalValue): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Readonly<Record<string, CanonicalValue>>;
  return `{${Object.keys(record)
    .sort(compareAscii)
    .map((key) => {
      const entry = record[key];
      if (entry === undefined)
        throw new Error("Checkpoint value contains undefined");
      return `${JSON.stringify(key)}:${canonicalJson(entry)}`;
    })
    .join(",")}}`;
};

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
