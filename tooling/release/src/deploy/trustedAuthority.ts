import { createHash } from "node:crypto";

export const MAX_TRUSTED_PRODUCTION_APPROVAL_TTL_MS = 10 * 60 * 1_000;

export type TrustedProductionApprovalPayload = {
  readonly schemaVersion: 1;
  readonly kind: "trusted-production-approval";
  readonly issuerId: string;
  readonly issuerClass: "release-controller" | "emergency-controller";
  readonly environment: "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly approvalEvidenceFingerprint: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
};

export type TrustedProductionApproval = TrustedProductionApprovalPayload & {
  readonly canonicalHash: string;
};

export const hashTrustedProductionApproval = (
  payload: TrustedProductionApprovalPayload,
): string =>
  `sha256:${createHash("sha256").update(canonical(payload)).digest("hex")}`;

export const verifyTrustedProductionApproval = (
  input: unknown,
  expected: TrustedProductionApproval,
  now: number,
):
  | { readonly ok: true; readonly approval: TrustedProductionApproval }
  | { readonly ok: false } => {
  if (!isApproval(input) || !Number.isSafeInteger(now) || now < 0)
    return { ok: false };
  const payload = approvalPayload(input);
  if (
    hashTrustedProductionApproval(payload) !== input.canonicalHash ||
    canonical(input) !== canonical(expected) ||
    now < input.issuedAt ||
    now >= input.expiresAt ||
    input.expiresAt - input.issuedAt > MAX_TRUSTED_PRODUCTION_APPROVAL_TTL_MS
  )
    return { ok: false };
  return { ok: true, approval: Object.freeze({ ...input }) };
};

const isApproval = (input: unknown): input is TrustedProductionApproval => {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return false;
  const value = input as Record<string, unknown>;
  return (
    value.schemaVersion === 1 &&
    value.kind === "trusted-production-approval" &&
    (value.issuerClass === "release-controller" ||
      value.issuerClass === "emergency-controller") &&
    value.environment === "production" &&
    typeof value.issuerId === "string" &&
    /^[a-z][a-z0-9-]{0,62}$/.test(value.issuerId) &&
    typeof value.targetId === "string" &&
    /^[a-z][a-z0-9-]{0,62}$/.test(value.targetId) &&
    typeof value.commitSha === "string" &&
    /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value.commitSha) &&
    [
      value.artifactHash,
      value.approvalEvidenceFingerprint,
      value.canonicalHash,
    ].every((v) => typeof v === "string" && /^sha256:[0-9a-f]{64}$/.test(v)) &&
    Number.isSafeInteger(value.issuedAt) &&
    Number.isSafeInteger(value.expiresAt) &&
    (value.expiresAt as number) > (value.issuedAt as number) &&
    typeof value.nonce === "string" &&
    /^[A-Za-z0-9_-]{16,128}$/.test(value.nonce)
  );
};

const approvalPayload = (
  value: TrustedProductionApproval,
): TrustedProductionApprovalPayload => ({
  schemaVersion: value.schemaVersion,
  kind: value.kind,
  issuerId: value.issuerId,
  issuerClass: value.issuerClass,
  environment: value.environment,
  targetId: value.targetId,
  commitSha: value.commitSha,
  artifactHash: value.artifactHash,
  approvalEvidenceFingerprint: value.approvalEvidenceFingerprint,
  issuedAt: value.issuedAt,
  expiresAt: value.expiresAt,
  nonce: value.nonce,
});

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
};
