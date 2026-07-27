import { createHash } from "node:crypto";

import {
  MAX_PROMOTION_VERDICT_TTL_MS,
  parsePromotionVerdict,
  PROMOTION_VERDICT_SCHEMA_VERSION,
  type PromotionApproverClass,
  type PromotionCompatibility,
  type PromotionEvidenceFingerprint,
  type PromotionVerdict,
  type PromotionVerdictPayload,
  type PromotionWorkflowCensus,
} from "./contract.js";

export type IssuePromotionVerdictInput = {
  readonly fromEnvironment: string;
  readonly toEnvironment: string;
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly compatibility: readonly PromotionCompatibility[];
  readonly evidence: readonly PromotionEvidenceFingerprint[];
  readonly workflowCensus: PromotionWorkflowCensus;
  readonly approverClass: PromotionApproverClass;
  readonly ttlMs?: number;
};

export type PromotionVerdictDependencies = {
  readonly nowMs: () => number;
  readonly nonce: () => string;
};

export const canonicalPromotionVerdictJson = (
  payload: PromotionVerdictPayload,
): string => canonicalJson(payload);

export const hashPromotionVerdictPayload = (
  payload: PromotionVerdictPayload,
): string =>
  `sha256:${createHash("sha256")
    .update(canonicalPromotionVerdictJson(payload))
    .digest("hex")}`;

export const promotionVerdictPayload = (
  verdict: PromotionVerdict,
): PromotionVerdictPayload => ({
  schemaVersion: verdict.schemaVersion,
  kind: verdict.kind,
  mode: verdict.mode,
  decision: verdict.decision,
  fromEnvironment: verdict.fromEnvironment,
  toEnvironment: verdict.toEnvironment,
  targetId: verdict.targetId,
  commitSha: verdict.commitSha,
  artifactHash: verdict.artifactHash,
  compatibility: verdict.compatibility,
  evidence: verdict.evidence,
  workflowCensus: verdict.workflowCensus,
  approverClass: verdict.approverClass,
  issuedAt: verdict.issuedAt,
  expiresAt: verdict.expiresAt,
  nonce: verdict.nonce,
});

export const issuePromotionVerdict = (
  input: IssuePromotionVerdictInput,
  dependencies: PromotionVerdictDependencies,
): PromotionVerdict => {
  const issuedAt = dependencies.nowMs();
  const ttlMs = input.ttlMs ?? MAX_PROMOTION_VERDICT_TTL_MS;
  const payload: PromotionVerdictPayload = {
    schemaVersion: PROMOTION_VERDICT_SCHEMA_VERSION,
    kind: "promotion-verdict",
    mode: "plan-only",
    decision: "approve",
    fromEnvironment: input.fromEnvironment,
    toEnvironment: input.toEnvironment,
    targetId: input.targetId,
    commitSha: input.commitSha,
    artifactHash: input.artifactHash,
    compatibility: input.compatibility.map((entry) => ({ ...entry })),
    evidence: input.evidence.map((entry) => ({ ...entry })),
    workflowCensus: { ...input.workflowCensus },
    approverClass: input.approverClass,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
    nonce: dependencies.nonce(),
  };
  return parsePromotionVerdict({
    ...payload,
    canonicalHash: hashPromotionVerdictPayload(payload),
  });
};

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
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((key) => {
      const entry = record[key];
      if (entry === undefined) {
        throw new Error("Canonical promotion verdict contains undefined");
      }
      return `${JSON.stringify(key)}:${canonicalJson(entry)}`;
    })
    .join(",")}}`;
};
