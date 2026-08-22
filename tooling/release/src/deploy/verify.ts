import {
  parsePromotionVerdict,
  PromotionVerdictContractError,
  type PromotionApproverClass,
  type PromotionCompatibility,
  type PromotionEvidenceFingerprint,
  type PromotionVerdict,
  type PromotionWorkflowCensus,
} from "./contract.js";
import {
  hashPromotionVerdictPayload,
  promotionVerdictPayload,
} from "./verdict.js";

export type PromotionVerdictExpectation = {
  readonly fromEnvironment: string;
  readonly toEnvironment: string;
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly compatibility: readonly PromotionCompatibility[];
  readonly evidence: readonly PromotionEvidenceFingerprint[];
  readonly workflowCensus: PromotionWorkflowCensus;
  readonly approverClass: PromotionApproverClass;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
};

export type PromotionVerdictVerificationCode =
  | "invalid-contract"
  | "tampered"
  | "not-yet-valid"
  | "expired"
  | "nonce-replayed"
  | "expectation-mismatch";

export type PromotionVerdictVerification =
  | { readonly ok: true; readonly verdict: PromotionVerdict }
  | {
      readonly ok: false;
      readonly code: PromotionVerdictVerificationCode;
      readonly findings: readonly string[];
    };

export type VerifyPromotionVerdictDependencies = {
  readonly nowMs: () => number;
  readonly consumedNonces?: ReadonlySet<string> | readonly string[];
};

export const verifyPromotionVerdict = (
  input: unknown,
  expected: PromotionVerdictExpectation,
  dependencies: VerifyPromotionVerdictDependencies,
): PromotionVerdictVerification => {
  let verdict: PromotionVerdict;
  try {
    verdict = parsePromotionVerdict(input);
  } catch (error) {
    return {
      ok: false,
      code: "invalid-contract",
      findings:
        error instanceof PromotionVerdictContractError
          ? error.findings
          : ["Promotion verdict parsing failed closed"],
    };
  }
  if (
    hashPromotionVerdictPayload(promotionVerdictPayload(verdict)) !==
    verdict.canonicalHash
  ) {
    return {
      ok: false,
      code: "tampered",
      findings: ["Promotion verdict canonical hash does not match its payload"],
    };
  }
  const now = dependencies.nowMs();
  if (!Number.isSafeInteger(now) || now < 0) {
    return {
      ok: false,
      code: "invalid-contract",
      findings: ["Verification clock must be a nonnegative safe integer"],
    };
  }
  if (now < verdict.issuedAt) {
    return {
      ok: false,
      code: "not-yet-valid",
      findings: ["Promotion verdict was issued after the verification clock"],
    };
  }
  if (now >= verdict.expiresAt) {
    return {
      ok: false,
      code: "expired",
      findings: ["Promotion verdict is stale"],
    };
  }
  const consumed = dependencies.consumedNonces;
  if (
    consumed !== undefined &&
    (Array.isArray(consumed)
      ? consumed.includes(verdict.nonce)
      : (consumed as ReadonlySet<string>).has(verdict.nonce))
  ) {
    return {
      ok: false,
      code: "nonce-replayed",
      findings: ["Promotion verdict nonce was already consumed"],
    };
  }
  const actualExpectation: PromotionVerdictExpectation = {
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
  };
  const findings = exactMismatchFindings(actualExpectation, expected);
  if (findings.length > 0) {
    return {
      ok: false,
      code: "expectation-mismatch",
      findings: Object.freeze(findings),
    };
  }
  return { ok: true, verdict };
};

const exactMismatchFindings = (
  actual: PromotionVerdictExpectation,
  expected: PromotionVerdictExpectation,
): string[] => {
  const findings: string[] = [];
  for (const key of [
    "fromEnvironment",
    "toEnvironment",
    "targetId",
    "commitSha",
    "artifactHash",
    "approverClass",
    "issuedAt",
    "expiresAt",
    "nonce",
  ] as const) {
    if (actual[key] !== expected[key]) findings.push(`${key} does not match`);
  }
  if (
    JSON.stringify(actual.compatibility) !==
    JSON.stringify(expected.compatibility)
  ) {
    findings.push("compatibility does not match exactly");
  }
  if (JSON.stringify(actual.evidence) !== JSON.stringify(expected.evidence)) {
    findings.push("evidence does not match exactly");
  }
  if (
    JSON.stringify(actual.workflowCensus) !==
    JSON.stringify(expected.workflowCensus)
  ) {
    findings.push("workflowCensus does not match exactly");
  }
  return findings;
};
