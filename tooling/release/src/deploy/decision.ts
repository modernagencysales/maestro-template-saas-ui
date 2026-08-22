import { createHash } from "node:crypto";

import {
  parsePromotionVerdict,
  type PromotionApproverClass,
  type PromotionEvidenceClass as VerdictEvidenceClass,
  type PromotionEvidenceFingerprint,
  type PromotionWorkflowCensus,
} from "./contract.js";
import {
  verifyDeployAuthority,
  type DeployAuthorityExpectation,
  type VerifyDeployAuthorityDependencies,
} from "./authority.js";
import {
  evaluatePromotionRequirements,
  type PromotionReadinessInput,
  type PromotionReadinessResult,
  type PromotionRequirement,
  type PromotionRequirementEvidence,
} from "./requirements.js";
import {
  verifyTrustedProductionApproval,
  type TrustedProductionApproval,
} from "./trustedAuthority.js";

export type PromotionDecisionInput = {
  readonly verdict: unknown;
  readonly lease: unknown;
  readonly authorityExpectation: DeployAuthorityExpectation;
  readonly readiness: PromotionReadinessInput;
  readonly trustedProductionApproval?: {
    readonly candidate: unknown;
    readonly expected: TrustedProductionApproval;
  };
};

export type PromotionDecisionDependencies = Omit<
  VerifyDeployAuthorityDependencies,
  "nowMs"
> & {
  readonly nowMs: () => number;
};

export type PromotionDecisionFinding = {
  readonly source: "authority" | "requirements" | "binding";
  readonly code: string;
  readonly detail: string;
};

export type PromotionDecisionReceiptPayload = {
  readonly schemaVersion: 1;
  readonly kind: "promotion-decision-receipt";
  readonly mode: "verification-only";
  readonly decision: "approve";
  readonly transition: string;
  readonly fromEnvironment: string;
  readonly toEnvironment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly approverClass: PromotionApproverClass;
  readonly evidence: readonly PromotionEvidenceFingerprint[];
  readonly workflowCensus: PromotionWorkflowCensus;
  readonly verdictHash: string;
  readonly verdictNonce: string;
  readonly authority: {
    readonly jobId: string;
    readonly leaseId: string;
    readonly leaseNonce: string;
    readonly credentialScopes: readonly string[];
    readonly credentialSetFingerprint: string;
  };
  readonly decidedAt: number;
  readonly expiresAt: number;
};

export type PromotionDecisionReceipt = PromotionDecisionReceiptPayload & {
  readonly canonicalHash: string;
};

export type PromotionDecisionResult =
  | { readonly kind: "approved"; readonly receipt: PromotionDecisionReceipt }
  | {
      readonly kind: "blocked";
      readonly findings: readonly PromotionDecisionFinding[];
    };

export type PromotionDecisionReceiptVerification =
  | { readonly ok: true; readonly receipt: PromotionDecisionReceipt }
  | {
      readonly ok: false;
      readonly code: "invalid-receipt" | "tampered" | "stale" | "mismatch";
    };

const verdictEvidenceOrder: readonly VerdictEvidenceClass[] = [
  "artifact-provenance",
  "build-verification",
  "compatibility-verification",
  "privacy-verification",
  "runtime-verification",
  "security-verification",
];

export const projectPromotionVerdictEvidence = (
  readiness: Extract<PromotionReadinessResult, { readonly kind: "ready" }>,
): readonly PromotionEvidenceFingerprint[] => {
  const grouped = new Map<
    VerdictEvidenceClass,
    PromotionRequirementEvidence[]
  >();
  for (const evidence of readiness.evidence) {
    const evidenceClass = verdictClassFor(evidence.requirement);
    const entries = grouped.get(evidenceClass) ?? [];
    entries.push(evidence);
    grouped.set(evidenceClass, entries);
  }
  return Object.freeze(
    verdictEvidenceOrder.flatMap((evidenceClass) => {
      const entries = grouped.get(evidenceClass);
      if (entries === undefined) return [];
      return [
        Object.freeze({
          class: evidenceClass,
          fingerprint: sha256(
            canonicalJson({
              schemaVersion: 1,
              evidenceClass,
              evidence: entries,
            }),
          ),
        }),
      ];
    }),
  );
};

export const decidePromotion = (
  input: PromotionDecisionInput,
  dependencies: PromotionDecisionDependencies,
): PromotionDecisionResult => {
  const now = dependencies.nowMs();
  const readiness = evaluatePromotionRequirements(input.readiness, {
    nowMs: () => now,
  });
  const authority = verifyDeployAuthority(
    { verdict: input.verdict, lease: input.lease },
    input.authorityExpectation,
    {
      nowMs: () => now,
      ...(dependencies.consumedVerdictNonces === undefined
        ? {}
        : { consumedVerdictNonces: dependencies.consumedVerdictNonces }),
      ...(dependencies.consumedLeaseNonces === undefined
        ? {}
        : { consumedLeaseNonces: dependencies.consumedLeaseNonces }),
    },
  );
  const findings: PromotionDecisionFinding[] = [];
  if (input.readiness.toEnvironment === "production") {
    const trusted = input.trustedProductionApproval;
    const verified =
      trusted === undefined
        ? { ok: false as const }
        : verifyTrustedProductionApproval(
            trusted.candidate,
            trusted.expected,
            now,
          );
    const approvalEvidence = input.readiness.evidence.find(
      ({ requirement }) => requirement === "human-approval",
    );
    if (
      !verified.ok ||
      approvalEvidence === undefined ||
      verified.approval.targetId !== input.readiness.targetId ||
      verified.approval.commitSha !== input.readiness.commitSha ||
      verified.approval.artifactHash !== input.readiness.artifactHash ||
      verified.approval.approvalEvidenceFingerprint !==
        approvalEvidence.fingerprint ||
      verified.approval.issuerClass !== input.readiness.approverClass
    ) {
      findings.push(
        decisionFinding(
          "authority",
          "trusted-production-approval-rejected",
          "Production approval must come from the exact trusted issuer record for this artifact.",
        ),
      );
    }
  }
  if (readiness.kind === "blocked") {
    findings.push(
      ...readiness.findings.map((finding) =>
        decisionFinding(
          "requirements",
          finding.code,
          `${finding.detail} ${finding.remediation}`,
        ),
      ),
    );
  }
  if (!authority.ok) {
    findings.push(
      ...authority.findings.map((detail) =>
        decisionFinding("authority", authority.code, detail),
      ),
    );
  }
  if (findings.length > 0 || readiness.kind !== "ready" || !authority.ok) {
    return blocked(findings);
  }
  const verdict = parsePromotionVerdict(input.verdict);
  const projectedEvidence = projectPromotionVerdictEvidence(readiness);
  const bindingFindings = crossBindingFindings(
    input.readiness,
    verdict,
    projectedEvidence,
  );
  if (bindingFindings.length > 0) return blocked(bindingFindings);
  const census = input.readiness.workflowCensus;
  if (census === undefined) {
    return blocked([
      decisionFinding(
        "binding",
        "census-missing",
        "A staging or production decision requires an exact workflow census.",
      ),
    ]);
  }
  const expiresAt = Math.min(
    verdict.expiresAt,
    input.authorityExpectation.lease.expiresAt,
    ...readiness.evidence.map((evidence) => evidence.expiresAt),
  );
  if (expiresAt <= now) {
    return blocked([
      decisionFinding(
        "binding",
        "decision-stale",
        "The composed promotion decision has no remaining validity window.",
      ),
    ]);
  }
  const payload: PromotionDecisionReceiptPayload = {
    schemaVersion: 1,
    kind: "promotion-decision-receipt",
    mode: "verification-only",
    decision: "approve",
    transition: readiness.transition,
    fromEnvironment: verdict.fromEnvironment,
    toEnvironment: authority.authorization.environment,
    targetId: verdict.targetId,
    commitSha: verdict.commitSha,
    artifactHash: verdict.artifactHash,
    approverClass: verdict.approverClass,
    evidence: projectedEvidence,
    workflowCensus: Object.freeze({ ...census }),
    verdictHash: verdict.canonicalHash,
    verdictNonce: verdict.nonce,
    authority: Object.freeze({
      jobId: authority.authorization.jobId,
      leaseId: authority.authorization.leaseId,
      leaseNonce: authority.authorization.leaseNonce,
      credentialScopes: Object.freeze([
        ...authority.authorization.credentialScopes,
      ]),
      credentialSetFingerprint:
        authority.authorization.credentialSetFingerprint,
    }),
    decidedAt: now,
    expiresAt,
  };
  const receipt = Object.freeze({
    ...payload,
    canonicalHash: hashPromotionDecisionReceiptPayload(payload),
  });
  return Object.freeze({ kind: "approved", receipt });
};

export const verifyPromotionDecisionReceipt = (
  input: unknown,
  expected: PromotionDecisionReceipt,
  nowMs: number,
): PromotionDecisionReceiptVerification => {
  if (!isPromotionDecisionReceipt(input) || !isTime(nowMs)) {
    return { ok: false, code: "invalid-receipt" };
  }
  const receipt = freezeDecisionReceipt(input);
  const payload = decisionReceiptPayload(receipt);
  if (hashPromotionDecisionReceiptPayload(payload) !== receipt.canonicalHash) {
    return { ok: false, code: "tampered" };
  }
  if (nowMs < receipt.decidedAt || nowMs >= receipt.expiresAt) {
    return { ok: false, code: "stale" };
  }
  if (canonicalJson(receipt) !== canonicalJson(expected)) {
    return { ok: false, code: "mismatch" };
  }
  return { ok: true, receipt };
};

export const hashPromotionDecisionReceiptPayload = (
  payload: PromotionDecisionReceiptPayload,
): string => sha256(canonicalJson(payload));

const crossBindingFindings = (
  readiness: PromotionReadinessInput,
  verdict: ReturnType<typeof parsePromotionVerdict>,
  projectedEvidence: readonly PromotionEvidenceFingerprint[],
): PromotionDecisionFinding[] => {
  const findings: PromotionDecisionFinding[] = [];
  for (const key of [
    "fromEnvironment",
    "toEnvironment",
    "targetId",
    "commitSha",
    "artifactHash",
    "approverClass",
  ] as const) {
    if (readiness[key] !== verdict[key]) {
      findings.push(
        decisionFinding(
          "binding",
          `${key}-mismatch`,
          `Readiness ${key} does not match the trusted verdict.`,
        ),
      );
    }
  }
  if (
    canonicalJson(readiness.workflowCensus) !==
    canonicalJson(verdict.workflowCensus)
  ) {
    findings.push(
      decisionFinding(
        "binding",
        "census-mismatch",
        "Readiness census does not match the trusted verdict census.",
      ),
    );
  }
  if (canonicalJson(projectedEvidence) !== canonicalJson(verdict.evidence)) {
    findings.push(
      decisionFinding(
        "binding",
        "evidence-mismatch",
        "Exact promotion requirements are not bound into the trusted verdict evidence.",
      ),
    );
  }
  return findings;
};

const verdictClassFor = (
  requirement: PromotionRequirement,
): VerdictEvidenceClass => {
  if (
    requirement === "immutable-artifact" ||
    requirement === "exact-staged-artifact"
  ) {
    return "artifact-provenance";
  }
  if (
    requirement === "local-deterministic-gates" ||
    requirement === "local-visible-app"
  ) {
    return "build-verification";
  }
  if (
    requirement === "migration-readiness" ||
    requirement === "rollback-readiness" ||
    requirement === "workflow-compatibility"
  ) {
    return "compatibility-verification";
  }
  if (requirement === "privacy-no-network") return "privacy-verification";
  if (requirement === "human-approval") return "security-verification";
  return "runtime-verification";
};

const decisionReceiptPayload = (
  receipt: PromotionDecisionReceipt,
): PromotionDecisionReceiptPayload => ({
  schemaVersion: receipt.schemaVersion,
  kind: receipt.kind,
  mode: receipt.mode,
  decision: receipt.decision,
  transition: receipt.transition,
  fromEnvironment: receipt.fromEnvironment,
  toEnvironment: receipt.toEnvironment,
  targetId: receipt.targetId,
  commitSha: receipt.commitSha,
  artifactHash: receipt.artifactHash,
  approverClass: receipt.approverClass,
  evidence: receipt.evidence,
  workflowCensus: receipt.workflowCensus,
  verdictHash: receipt.verdictHash,
  verdictNonce: receipt.verdictNonce,
  authority: receipt.authority,
  decidedAt: receipt.decidedAt,
  expiresAt: receipt.expiresAt,
});

const freezeDecisionReceipt = (
  receipt: PromotionDecisionReceipt,
): PromotionDecisionReceipt =>
  Object.freeze({
    ...receipt,
    evidence: Object.freeze(
      receipt.evidence.map((evidence) => Object.freeze({ ...evidence })),
    ),
    workflowCensus: Object.freeze({ ...receipt.workflowCensus }),
    authority: Object.freeze({
      ...receipt.authority,
      credentialScopes: Object.freeze([...receipt.authority.credentialScopes]),
    }),
  });

const isPromotionDecisionReceipt = (
  input: unknown,
): input is PromotionDecisionReceipt => {
  if (!isRecord(input)) return false;
  if (
    !hasExactKeys(input, [
      "schemaVersion",
      "kind",
      "mode",
      "decision",
      "transition",
      "fromEnvironment",
      "toEnvironment",
      "targetId",
      "commitSha",
      "artifactHash",
      "approverClass",
      "evidence",
      "workflowCensus",
      "verdictHash",
      "verdictNonce",
      "authority",
      "decidedAt",
      "expiresAt",
      "canonicalHash",
    ]) ||
    input.schemaVersion !== 1 ||
    input.kind !== "promotion-decision-receipt" ||
    input.mode !== "verification-only" ||
    input.decision !== "approve" ||
    (input.toEnvironment !== "staging" &&
      input.toEnvironment !== "production") ||
    !isStringFields(input, [
      "transition",
      "fromEnvironment",
      "targetId",
      "commitSha",
      "artifactHash",
      "approverClass",
      "verdictHash",
      "verdictNonce",
      "canonicalHash",
    ]) ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(input.commitSha as string) ||
    !isSha256(input.artifactHash) ||
    !isSha256(input.verdictHash) ||
    !isSha256(input.canonicalHash) ||
    !isNonce(input.verdictNonce) ||
    (input.approverClass !== "release-controller" &&
      input.approverClass !== "security-controller" &&
      input.approverClass !== "emergency-controller") ||
    input.transition !==
      `${String(input.fromEnvironment)}->${String(input.toEnvironment)}` ||
    !isTime(input.decidedAt) ||
    !isTime(input.expiresAt) ||
    input.expiresAt <= input.decidedAt ||
    !Array.isArray(input.evidence) ||
    input.evidence.length === 0 ||
    !input.evidence.every(isEvidenceFingerprint) ||
    !isCensus(input.workflowCensus) ||
    !isAuthority(input.authority)
  ) {
    return false;
  }
  const classes = input.evidence.map((entry) => entry.class);
  const canonicalClasses = verdictEvidenceOrder.filter((value) =>
    classes.includes(value),
  );
  return (
    new Set(classes).size === classes.length &&
    classes.every((value, index) => value === canonicalClasses[index])
  );
};

const isEvidenceFingerprint = (
  input: unknown,
): input is PromotionEvidenceFingerprint =>
  isRecord(input) &&
  hasExactKeys(input, ["class", "fingerprint"]) &&
  verdictEvidenceOrder.includes(input.class as VerdictEvidenceClass) &&
  isSha256(input.fingerprint);

const isCensus = (input: unknown): input is PromotionWorkflowCensus =>
  isRecord(input) &&
  hasExactKeys(input, ["capturedAt", "active", "restartable", "fingerprint"]) &&
  isTime(input.capturedAt) &&
  isTime(input.active) &&
  isTime(input.restartable) &&
  isSha256(input.fingerprint);

const isAuthority = (
  input: unknown,
): input is PromotionDecisionReceiptPayload["authority"] =>
  isRecord(input) &&
  hasExactKeys(input, [
    "jobId",
    "leaseId",
    "leaseNonce",
    "credentialScopes",
    "credentialSetFingerprint",
  ]) &&
  isStringFields(input, ["jobId", "leaseId", "leaseNonce"]) &&
  isSha256(input.credentialSetFingerprint) &&
  Array.isArray(input.credentialScopes) &&
  input.credentialScopes.length > 0 &&
  input.credentialScopes.every((value) => typeof value === "string") &&
  new Set(input.credentialScopes).size === input.credentialScopes.length &&
  input.credentialScopes.every(
    (value, index, values) => index === 0 || (values[index - 1] ?? "") < value,
  ) &&
  isNonce(input.leaseNonce);

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const hasExactKeys = (
  input: Record<string, unknown>,
  keys: readonly string[],
): boolean =>
  Object.keys(input).length === keys.length &&
  keys.every((key) => Object.hasOwn(input, key));

const isStringFields = (
  input: Record<string, unknown>,
  keys: readonly string[],
): boolean => keys.every((key) => typeof input[key] === "string");

const isSha256 = (input: unknown): input is string =>
  typeof input === "string" && /^sha256:[0-9a-f]{64}$/.test(input);

const isNonce = (input: unknown): input is string =>
  typeof input === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(input);

const isTime = (input: unknown): input is number =>
  Number.isSafeInteger(input) && (input as number) >= 0;

const blocked = (
  findings: readonly PromotionDecisionFinding[],
): PromotionDecisionResult =>
  Object.freeze({ kind: "blocked", findings: Object.freeze([...findings]) });

const decisionFinding = (
  source: PromotionDecisionFinding["source"],
  code: string,
  detail: string,
): PromotionDecisionFinding => Object.freeze({ source, code, detail });

const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue }
  | undefined;

const canonicalJson = (value: CanonicalValue): string => {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Readonly<Record<string, CanonicalValue>>;
  return `{${Object.keys(record)
    .sort(compareAscii)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
};

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
