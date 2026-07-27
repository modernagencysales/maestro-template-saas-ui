export const PROMOTION_VERDICT_SCHEMA_VERSION = 1 as const;
export const MAX_PROMOTION_VERDICT_TTL_MS = 10 * 60 * 1_000;

export type PromotionEvidenceClass =
  | "artifact-provenance"
  | "build-verification"
  | "compatibility-verification"
  | "privacy-verification"
  | "runtime-verification"
  | "security-verification";

export type PromotionApproverClass =
  "emergency-controller" | "release-controller" | "security-controller";

export type PromotionCompatibility = {
  readonly component: string;
  readonly version: string;
};

export type PromotionEvidenceFingerprint = {
  readonly class: PromotionEvidenceClass;
  readonly fingerprint: string;
};

export type PromotionWorkflowCensus = {
  readonly capturedAt: number;
  readonly active: number;
  readonly restartable: number;
  readonly fingerprint: string;
};

export type PromotionVerdictPayload = {
  readonly schemaVersion: typeof PROMOTION_VERDICT_SCHEMA_VERSION;
  readonly kind: "promotion-verdict";
  readonly mode: "plan-only";
  readonly decision: "approve";
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

export type PromotionVerdict = PromotionVerdictPayload & {
  readonly canonicalHash: string;
};

export class PromotionVerdictContractError extends Error {
  readonly findings: readonly string[];

  constructor(findings: readonly string[]) {
    super(findings.join("\n"));
    this.name = "PromotionVerdictContractError";
    this.findings = findings;
  }
}

const evidenceClasses: readonly PromotionEvidenceClass[] = [
  "artifact-provenance",
  "build-verification",
  "compatibility-verification",
  "privacy-verification",
  "runtime-verification",
  "security-verification",
];
const approverClasses: readonly PromotionApproverClass[] = [
  "emergency-controller",
  "release-controller",
  "security-controller",
];
const sha256 = /^sha256:[0-9a-f]{64}$/;
const commitSha = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const boundedId = /^[a-z][a-z0-9-]{0,62}$/;
const nonce = /^[A-Za-z0-9_-]{16,128}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const rejectUnknown = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
  findings: string[],
): void => {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) findings.push(`${label} has unknown field: ${key}`);
  }
};

const readString = (
  value: Record<string, unknown>,
  key: string,
  label: string,
  findings: string[],
): string => {
  const field = value[key];
  if (typeof field === "string") return field;
  findings.push(`${label}.${key} must be a string`);
  return "";
};

const readSafeInteger = (
  value: Record<string, unknown>,
  key: string,
  label: string,
  findings: string[],
): number => {
  const field = value[key];
  if (Number.isSafeInteger(field) && (field as number) >= 0) {
    return field as number;
  }
  findings.push(`${label}.${key} must be a nonnegative safe integer`);
  return 0;
};

const parseCompatibility = (
  value: unknown,
  index: number,
  findings: string[],
): PromotionCompatibility | undefined => {
  const label = `compatibility[${index}]`;
  if (!isRecord(value)) {
    findings.push(`${label} must be an object`);
    return undefined;
  }
  rejectUnknown(value, ["component", "version"], label, findings);
  const component = readString(value, "component", label, findings);
  const version = readString(value, "version", label, findings);
  if (!boundedId.test(component)) {
    findings.push(`${label}.component must be a bounded lowercase identifier`);
  }
  if (version.length === 0 || version.length > 128) {
    findings.push(`${label}.version must contain 1 to 128 characters`);
  }
  return Object.freeze({ component, version });
};

const parseEvidence = (
  value: unknown,
  index: number,
  findings: string[],
): PromotionEvidenceFingerprint | undefined => {
  const label = `evidence[${index}]`;
  if (!isRecord(value)) {
    findings.push(`${label} must be an object`);
    return undefined;
  }
  rejectUnknown(value, ["class", "fingerprint"], label, findings);
  const evidenceClass = readString(value, "class", label, findings);
  const fingerprint = readString(value, "fingerprint", label, findings);
  if (!evidenceClasses.includes(evidenceClass as PromotionEvidenceClass)) {
    findings.push(`${label}.class is unsupported`);
  }
  if (!sha256.test(fingerprint)) {
    findings.push(`${label}.fingerprint must be a lowercase sha256 digest`);
  }
  return Object.freeze({
    class: evidenceClass as PromotionEvidenceClass,
    fingerprint,
  });
};

const parseCensus = (
  value: unknown,
  findings: string[],
): PromotionWorkflowCensus => {
  const label = "workflowCensus";
  if (!isRecord(value)) {
    findings.push(`${label} must be an object`);
    return Object.freeze({
      capturedAt: 0,
      active: 0,
      restartable: 0,
      fingerprint: "",
    });
  }
  rejectUnknown(
    value,
    ["capturedAt", "active", "restartable", "fingerprint"],
    label,
    findings,
  );
  const capturedAt = readSafeInteger(value, "capturedAt", label, findings);
  const active = readSafeInteger(value, "active", label, findings);
  const restartable = readSafeInteger(value, "restartable", label, findings);
  const fingerprint = readString(value, "fingerprint", label, findings);
  if (!sha256.test(fingerprint)) {
    findings.push(`${label}.fingerprint must be a lowercase sha256 digest`);
  }
  return Object.freeze({ capturedAt, active, restartable, fingerprint });
};

const parseOrderedArray = <Value>(input: {
  readonly value: unknown;
  readonly label: string;
  readonly identity: (value: Value) => string;
  readonly parse: (
    value: unknown,
    index: number,
    findings: string[],
  ) => Value | undefined;
  readonly findings: string[];
}): readonly Value[] => {
  if (!Array.isArray(input.value) || input.value.length === 0) {
    input.findings.push(`${input.label} must be a non-empty array`);
    return Object.freeze([]);
  }
  const parsed = input.value.flatMap((value, index) => {
    const item = input.parse(value, index, input.findings);
    return item === undefined ? [] : [item];
  });
  const identities = parsed.map(input.identity);
  if (new Set(identities).size !== identities.length) {
    input.findings.push(`${input.label} contains duplicate identities`);
  }
  const sorted = [...identities].sort(compareAscii);
  if (identities.some((identity, index) => identity !== sorted[index])) {
    input.findings.push(`${input.label} must be in canonical identity order`);
  }
  return Object.freeze(parsed);
};

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const parsePromotionVerdict = (input: unknown): PromotionVerdict => {
  const findings: string[] = [];
  if (!isRecord(input)) {
    throw new PromotionVerdictContractError([
      "Promotion verdict must be an object",
    ]);
  }
  rejectUnknown(
    input,
    [
      "schemaVersion",
      "kind",
      "mode",
      "decision",
      "fromEnvironment",
      "toEnvironment",
      "targetId",
      "commitSha",
      "artifactHash",
      "compatibility",
      "evidence",
      "workflowCensus",
      "approverClass",
      "issuedAt",
      "expiresAt",
      "nonce",
      "canonicalHash",
    ],
    "promotion verdict",
    findings,
  );
  if (input.schemaVersion !== PROMOTION_VERDICT_SCHEMA_VERSION) {
    findings.push("promotion verdict schemaVersion must be 1");
  }
  if (input.kind !== "promotion-verdict") {
    findings.push("promotion verdict kind must be promotion-verdict");
  }
  if (input.mode !== "plan-only") {
    findings.push("promotion verdict mode must be plan-only");
  }
  if (input.decision !== "approve") {
    findings.push("promotion verdict decision must be approve");
  }
  const fromEnvironment = readString(
    input,
    "fromEnvironment",
    "promotion verdict",
    findings,
  );
  const toEnvironment = readString(
    input,
    "toEnvironment",
    "promotion verdict",
    findings,
  );
  const targetId = readString(input, "targetId", "promotion verdict", findings);
  for (const [label, value] of [
    ["fromEnvironment", fromEnvironment],
    ["toEnvironment", toEnvironment],
    ["targetId", targetId],
  ] as const) {
    if (!boundedId.test(value)) {
      findings.push(`${label} must be a bounded lowercase identifier`);
    }
  }
  if (fromEnvironment === toEnvironment) {
    findings.push("fromEnvironment and toEnvironment must differ");
  }
  const parsedCommitSha = readString(
    input,
    "commitSha",
    "promotion verdict",
    findings,
  );
  if (!commitSha.test(parsedCommitSha)) {
    findings.push("commitSha must be an exact lowercase Git object id");
  }
  const artifactHash = readString(
    input,
    "artifactHash",
    "promotion verdict",
    findings,
  );
  if (!sha256.test(artifactHash)) {
    findings.push("artifactHash must be a lowercase sha256 digest");
  }
  const compatibility = parseOrderedArray({
    value: input.compatibility,
    label: "compatibility",
    identity: (value: PromotionCompatibility) => value.component,
    parse: parseCompatibility,
    findings,
  });
  const evidence = parseOrderedArray({
    value: input.evidence,
    label: "evidence",
    identity: (value: PromotionEvidenceFingerprint) => value.class,
    parse: parseEvidence,
    findings,
  });
  const workflowCensus = parseCensus(input.workflowCensus, findings);
  const approverClass = readString(
    input,
    "approverClass",
    "promotion verdict",
    findings,
  );
  if (!approverClasses.includes(approverClass as PromotionApproverClass)) {
    findings.push("approverClass is unsupported");
  }
  const issuedAt = readSafeInteger(
    input,
    "issuedAt",
    "promotion verdict",
    findings,
  );
  const expiresAt = readSafeInteger(
    input,
    "expiresAt",
    "promotion verdict",
    findings,
  );
  if (expiresAt <= issuedAt) {
    findings.push("expiresAt must be later than issuedAt");
  } else if (expiresAt - issuedAt > MAX_PROMOTION_VERDICT_TTL_MS) {
    findings.push("promotion verdict exceeds the maximum lifetime");
  }
  if (workflowCensus.capturedAt > issuedAt) {
    findings.push("workflow census cannot be captured after verdict issuance");
  }
  const parsedNonce = readString(input, "nonce", "promotion verdict", findings);
  if (!nonce.test(parsedNonce)) {
    findings.push("nonce must contain 16 to 128 URL-safe characters");
  }
  const canonicalHash = readString(
    input,
    "canonicalHash",
    "promotion verdict",
    findings,
  );
  if (!sha256.test(canonicalHash)) {
    findings.push("canonicalHash must be a lowercase sha256 digest");
  }
  if (findings.length > 0) throw new PromotionVerdictContractError(findings);
  return Object.freeze({
    schemaVersion: PROMOTION_VERDICT_SCHEMA_VERSION,
    kind: "promotion-verdict",
    mode: "plan-only",
    decision: "approve",
    fromEnvironment,
    toEnvironment,
    targetId,
    commitSha: parsedCommitSha,
    artifactHash,
    compatibility,
    evidence,
    workflowCensus,
    approverClass: approverClass as PromotionApproverClass,
    issuedAt,
    expiresAt,
    nonce: parsedNonce,
    canonicalHash,
  });
};
