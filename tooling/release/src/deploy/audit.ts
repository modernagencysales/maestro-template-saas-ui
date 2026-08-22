import type {
  PromotionEvidenceFingerprint,
  PromotionWorkflowCensus,
} from "./contract.js";
import {
  verifyPromotionDecisionReceipt,
  type PromotionDecisionReceipt,
} from "./decision.js";

export type PromotionLaunchAttempt = {
  readonly fromEnvironment: string;
  readonly toEnvironment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly evidence: readonly PromotionEvidenceFingerprint[];
  readonly workflowCensus: PromotionWorkflowCensus;
  readonly verdictHash: string;
  readonly verdictNonce: string;
  readonly jobId: string;
  readonly leaseId: string;
  readonly leaseNonce: string;
  readonly credentialSetFingerprint: string;
};

export type PromotionReplayObservation = {
  readonly schemaVersion: 1;
  readonly kind: "promotion-decision-consumption";
  readonly receiptHash: string;
  readonly verdictNonce: string;
  readonly leaseNonce: string;
  readonly fromEnvironment: string;
  readonly toEnvironment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly consumedAt: number;
};

export type PromotionAuditExpectation = {
  readonly trustedReceipt: PromotionDecisionReceipt;
  readonly attempt: PromotionLaunchAttempt;
  readonly priorObservations: readonly PromotionReplayObservation[];
};

export type PromotionAuditCode =
  | "invalid-receipt"
  | "tampered-receipt"
  | "stale-window"
  | "receipt-mismatch"
  | "invalid-replay-history"
  | "nonce-reuse"
  | "cross-environment-replay"
  | "artifact-drift"
  | "evidence-drift"
  | "binding-drift";

export type PromotionAuditResult =
  | {
      readonly ok: true;
      readonly observation: PromotionReplayObservation;
    }
  | {
      readonly ok: false;
      readonly code: PromotionAuditCode;
      readonly findings: readonly string[];
    };

export type PromotionAuditDependencies = {
  readonly nowMs: () => number;
};

export const auditPromotionDecisionReceipt = (
  input: unknown,
  expected: PromotionAuditExpectation,
  dependencies: PromotionAuditDependencies,
): PromotionAuditResult => {
  const now = dependencies.nowMs();
  const receiptVerification = verifyPromotionDecisionReceipt(
    input,
    expected.trustedReceipt,
    now,
  );
  if (!receiptVerification.ok) {
    const code = receiptFailureCode(receiptVerification.code);
    return blocked(code, [
      `Promotion decision receipt failed: ${receiptVerification.code}.`,
    ]);
  }
  const receipt = receiptVerification.receipt;
  const attemptFindings = compareAttempt(receipt, expected.attempt);
  if (attemptFindings.crossEnvironment.length > 0) {
    return blocked(
      "cross-environment-replay",
      attemptFindings.crossEnvironment,
    );
  }
  if (attemptFindings.artifact.length > 0) {
    return blocked("artifact-drift", attemptFindings.artifact);
  }
  if (attemptFindings.evidence.length > 0) {
    return blocked("evidence-drift", attemptFindings.evidence);
  }
  if (attemptFindings.binding.length > 0) {
    return blocked("binding-drift", attemptFindings.binding);
  }
  const historyFindings = validateHistory(expected.priorObservations, now);
  if (historyFindings.length > 0) {
    return blocked("invalid-replay-history", historyFindings);
  }
  const reused = expected.priorObservations.find(
    (observation) =>
      observation.receiptHash === receipt.canonicalHash ||
      observation.verdictNonce === receipt.verdictNonce ||
      observation.leaseNonce === receipt.verdictNonce ||
      observation.verdictNonce === receipt.authority.leaseNonce ||
      observation.leaseNonce === receipt.authority.leaseNonce,
  );
  if (reused !== undefined) {
    if (
      reused.fromEnvironment !== receipt.fromEnvironment ||
      reused.toEnvironment !== receipt.toEnvironment ||
      reused.targetId !== receipt.targetId
    ) {
      return blocked("cross-environment-replay", [
        "A receipt, verdict nonce, or lease nonce was already observed for a different environment or target.",
      ]);
    }
    return blocked("nonce-reuse", [
      "The receipt, verdict nonce, or lease nonce was already consumed.",
    ]);
  }
  return {
    ok: true,
    observation: Object.freeze({
      schemaVersion: 1,
      kind: "promotion-decision-consumption",
      receiptHash: receipt.canonicalHash,
      verdictNonce: receipt.verdictNonce,
      leaseNonce: receipt.authority.leaseNonce,
      fromEnvironment: receipt.fromEnvironment,
      toEnvironment: receipt.toEnvironment,
      targetId: receipt.targetId,
      commitSha: receipt.commitSha,
      artifactHash: receipt.artifactHash,
      consumedAt: now,
    }),
  };
};

const compareAttempt = (
  receipt: PromotionDecisionReceipt,
  attempt: PromotionLaunchAttempt,
): Readonly<{
  crossEnvironment: string[];
  artifact: string[];
  evidence: string[];
  binding: string[];
}> => {
  const crossEnvironment: string[] = [];
  const artifact: string[] = [];
  const evidence: string[] = [];
  const binding: string[] = [];
  if (
    attempt.fromEnvironment !== receipt.fromEnvironment ||
    attempt.toEnvironment !== receipt.toEnvironment
  ) {
    crossEnvironment.push(
      "Launch attempt environment transition does not match the receipt.",
    );
  }
  if (attempt.targetId !== receipt.targetId) {
    crossEnvironment.push("Launch attempt target does not match the receipt.");
  }
  if (attempt.artifactHash !== receipt.artifactHash) {
    artifact.push("Launch attempt artifact does not match the receipt.");
  }
  if (canonicalJson(attempt.evidence) !== canonicalJson(receipt.evidence)) {
    evidence.push(
      "Launch attempt evidence fingerprints drifted from the receipt.",
    );
  }
  if (
    canonicalJson(attempt.workflowCensus) !==
    canonicalJson(receipt.workflowCensus)
  ) {
    evidence.push("Launch attempt workflow census drifted from the receipt.");
  }
  for (const [label, actual, receiptValue] of [
    ["commit", attempt.commitSha, receipt.commitSha],
    ["verdict hash", attempt.verdictHash, receipt.verdictHash],
    ["verdict nonce", attempt.verdictNonce, receipt.verdictNonce],
    ["job", attempt.jobId, receipt.authority.jobId],
    ["lease", attempt.leaseId, receipt.authority.leaseId],
    ["lease nonce", attempt.leaseNonce, receipt.authority.leaseNonce],
    [
      "credential set fingerprint",
      attempt.credentialSetFingerprint,
      receipt.authority.credentialSetFingerprint,
    ],
  ] as const) {
    if (actual !== receiptValue) {
      binding.push(`Launch attempt ${label} does not match the receipt.`);
    }
  }
  return { crossEnvironment, artifact, evidence, binding };
};

const validateHistory = (
  observations: readonly PromotionReplayObservation[],
  now: number,
): string[] => {
  const findings: string[] = [];
  const receiptHashes = new Set<string>();
  const nonces = new Set<string>();
  for (const [index, observation] of observations.entries()) {
    if (
      !isRecord(observation) ||
      !hasExactKeys(observation, [
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
      observation.schemaVersion !== 1 ||
      observation.kind !== "promotion-decision-consumption" ||
      !isSha256(observation.receiptHash) ||
      !isNonce(observation.verdictNonce) ||
      !isNonce(observation.leaseNonce) ||
      observation.verdictNonce === observation.leaseNonce ||
      (observation.toEnvironment !== "staging" &&
        observation.toEnvironment !== "production") ||
      typeof observation.fromEnvironment !== "string" ||
      observation.fromEnvironment.length === 0 ||
      typeof observation.targetId !== "string" ||
      observation.targetId.length === 0 ||
      !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(observation.commitSha) ||
      !isSha256(observation.artifactHash) ||
      !isTime(observation.consumedAt) ||
      observation.consumedAt > now
    ) {
      findings.push(`Replay observation ${index} is invalid.`);
      continue;
    }
    if (
      receiptHashes.has(observation.receiptHash) ||
      nonces.has(observation.verdictNonce) ||
      nonces.has(observation.leaseNonce)
    ) {
      findings.push(`Replay observation ${index} duplicates a prior identity.`);
    }
    receiptHashes.add(observation.receiptHash);
    nonces.add(observation.verdictNonce);
    nonces.add(observation.leaseNonce);
  }
  return findings;
};

const receiptFailureCode = (
  code: "invalid-receipt" | "tampered" | "stale" | "mismatch",
): PromotionAuditCode => {
  if (code === "tampered") return "tampered-receipt";
  if (code === "stale") return "stale-window";
  if (code === "mismatch") return "receipt-mismatch";
  return "invalid-receipt";
};

const blocked = (
  code: PromotionAuditCode,
  findings: readonly string[],
): PromotionAuditResult =>
  Object.freeze({
    ok: false,
    code,
    findings: Object.freeze([...findings]),
  });

const isSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);

const isNonce = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);

const isTime = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

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
        throw new Error("Audit value contains undefined");
      return `${JSON.stringify(key)}:${canonicalJson(entry)}`;
    })
    .join(",")}}`;
};

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
