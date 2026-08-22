import type { PromotionVerdict } from "./contract.js";
import {
  verifyPromotionVerdict,
  type PromotionVerdictExpectation,
  type PromotionVerdictVerificationCode,
} from "./verify.js";

export type DeployCredentialLeaseAttestation = {
  readonly schemaVersion: 1;
  readonly kind: "deploy-credential-lease";
  readonly jobClass: "gated-deploy";
  readonly jobId: string;
  readonly leaseId: string;
  readonly environment: string;
  readonly targetId: string;
  readonly credentialScopes: readonly string[];
  readonly credentialSetFingerprint: string;
  readonly verdictHash: string;
  readonly verdictNonce: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
};

export type DeployAuthorityExpectation = {
  readonly verdict: PromotionVerdictExpectation;
  readonly lease: DeployCredentialLeaseAttestation;
};

export type DeployAuthorityVerificationCode =
  | "verdict-rejected"
  | "invalid-lease"
  | "lease-not-yet-valid"
  | "lease-expired"
  | "lease-replayed"
  | "lease-mismatch";

export type DeployAuthorityVerification =
  | {
      readonly ok: true;
      readonly authorization: {
        readonly kind: "deploy-authority-verification";
        readonly mode: "verification-only";
        readonly environment: "staging" | "production";
        readonly targetId: string;
        readonly jobId: string;
        readonly leaseId: string;
        readonly credentialScopes: readonly string[];
        readonly credentialSetFingerprint: string;
        readonly verdictHash: string;
        readonly verdictNonce: string;
        readonly leaseNonce: string;
        readonly verifiedAt: number;
      };
    }
  | {
      readonly ok: false;
      readonly code: DeployAuthorityVerificationCode;
      readonly findings: readonly string[];
      readonly verdictCode?: PromotionVerdictVerificationCode;
    };

export type VerifyDeployAuthorityDependencies = {
  readonly nowMs: () => number;
  readonly consumedVerdictNonces?: ReadonlySet<string> | readonly string[];
  readonly consumedLeaseNonces?: ReadonlySet<string> | readonly string[];
};

class CredentialLeaseContractError extends Error {
  readonly findings: readonly string[];

  constructor(findings: readonly string[]) {
    super(findings.join("\n"));
    this.name = "CredentialLeaseContractError";
    this.findings = findings;
  }
}

const sha256 = /^sha256:[0-9a-f]{64}$/;
const boundedId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const environmentId = /^[a-z][a-z0-9-]{0,62}$/;
const scope = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const nonce = /^[A-Za-z0-9_-]{16,128}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseDeployCredentialLeaseAttestation = (
  input: unknown,
): DeployCredentialLeaseAttestation => {
  const findings: string[] = [];
  if (!isRecord(input)) {
    throw new CredentialLeaseContractError([
      "Deploy credential lease attestation must be an object",
    ]);
  }
  const allowed = new Set([
    "schemaVersion",
    "kind",
    "jobClass",
    "jobId",
    "leaseId",
    "environment",
    "targetId",
    "credentialScopes",
    "credentialSetFingerprint",
    "verdictHash",
    "verdictNonce",
    "issuedAt",
    "expiresAt",
    "nonce",
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key))
      findings.push(`Credential lease has unknown field: ${key}`);
  }
  if (input.schemaVersion !== 1) {
    findings.push("Credential lease schemaVersion must be 1");
  }
  if (input.kind !== "deploy-credential-lease") {
    findings.push("Credential lease kind must be deploy-credential-lease");
  }
  if (input.jobClass !== "gated-deploy") {
    findings.push("Credential lease jobClass must be gated-deploy");
  }
  const jobId = readString(input, "jobId", findings);
  const leaseId = readString(input, "leaseId", findings);
  const environment = readString(input, "environment", findings);
  const targetId = readString(input, "targetId", findings);
  if (!boundedId.test(jobId))
    findings.push("Credential lease jobId is invalid");
  if (!boundedId.test(leaseId))
    findings.push("Credential lease leaseId is invalid");
  if (!environmentId.test(environment)) {
    findings.push("Credential lease environment is invalid");
  }
  if (!environmentId.test(targetId)) {
    findings.push("Credential lease targetId is invalid");
  }
  const credentialScopes = parseCredentialScopes(
    input.credentialScopes,
    findings,
  );
  const credentialSetFingerprint = readString(
    input,
    "credentialSetFingerprint",
    findings,
  );
  const verdictHash = readString(input, "verdictHash", findings);
  if (!sha256.test(credentialSetFingerprint)) {
    findings.push("Credential lease set fingerprint must be a sha256 digest");
  }
  if (!sha256.test(verdictHash)) {
    findings.push("Credential lease verdict hash must be a sha256 digest");
  }
  const verdictNonce = readString(input, "verdictNonce", findings);
  const leaseNonce = readString(input, "nonce", findings);
  if (!nonce.test(verdictNonce)) {
    findings.push("Credential lease verdict nonce is invalid");
  }
  if (!nonce.test(leaseNonce)) {
    findings.push("Credential lease nonce is invalid");
  }
  if (verdictNonce === leaseNonce) {
    findings.push("Credential lease nonce must differ from the verdict nonce");
  }
  const issuedAt = readTime(input, "issuedAt", findings);
  const expiresAt = readTime(input, "expiresAt", findings);
  if (expiresAt <= issuedAt) {
    findings.push("Credential lease expiresAt must be later than issuedAt");
  }
  if (findings.length > 0) throw new CredentialLeaseContractError(findings);
  return Object.freeze({
    schemaVersion: 1,
    kind: "deploy-credential-lease",
    jobClass: "gated-deploy",
    jobId,
    leaseId,
    environment,
    targetId,
    credentialScopes,
    credentialSetFingerprint,
    verdictHash,
    verdictNonce,
    issuedAt,
    expiresAt,
    nonce: leaseNonce,
  });
};

export const verifyDeployAuthority = (
  input: {
    readonly verdict: unknown;
    readonly lease: unknown;
  },
  expected: DeployAuthorityExpectation,
  dependencies: VerifyDeployAuthorityDependencies,
): DeployAuthorityVerification => {
  const now = dependencies.nowMs();
  const verdictResult = verifyPromotionVerdict(
    input.verdict,
    expected.verdict,
    {
      nowMs: () => now,
      ...(dependencies.consumedVerdictNonces === undefined
        ? {}
        : { consumedNonces: dependencies.consumedVerdictNonces }),
    },
  );
  if (!verdictResult.ok) {
    return {
      ok: false,
      code: "verdict-rejected",
      verdictCode: verdictResult.code,
      findings: verdictResult.findings,
    };
  }
  let lease: DeployCredentialLeaseAttestation;
  try {
    lease = parseDeployCredentialLeaseAttestation(input.lease);
  } catch (error) {
    return {
      ok: false,
      code: "invalid-lease",
      findings:
        error instanceof CredentialLeaseContractError
          ? error.findings
          : ["Credential lease parsing failed closed"],
    };
  }
  const verdict = verdictResult.verdict;
  if (
    verdict.toEnvironment !== "staging" &&
    verdict.toEnvironment !== "production"
  ) {
    return {
      ok: false,
      code: "lease-mismatch",
      findings: [
        "Deploy authority is available only for staging or production",
      ],
    };
  }
  const bindingFindings = leaseBindingFindings(lease, verdict, expected.lease);
  if (bindingFindings.length > 0) {
    return {
      ok: false,
      code: "lease-mismatch",
      findings: Object.freeze(bindingFindings),
    };
  }
  if (
    lease.issuedAt < verdict.issuedAt ||
    lease.expiresAt > verdict.expiresAt
  ) {
    return {
      ok: false,
      code: "lease-mismatch",
      findings: [
        "Credential lease window must be contained by the verdict window",
      ],
    };
  }
  if (now < lease.issuedAt) {
    return {
      ok: false,
      code: "lease-not-yet-valid",
      findings: ["Credential lease was issued after the verification clock"],
    };
  }
  if (now >= lease.expiresAt) {
    return {
      ok: false,
      code: "lease-expired",
      findings: ["Credential lease is stale"],
    };
  }
  if (contains(dependencies.consumedLeaseNonces, lease.nonce)) {
    return {
      ok: false,
      code: "lease-replayed",
      findings: ["Credential lease nonce was already consumed"],
    };
  }
  return {
    ok: true,
    authorization: Object.freeze({
      kind: "deploy-authority-verification",
      mode: "verification-only",
      environment: verdict.toEnvironment,
      targetId: lease.targetId,
      jobId: lease.jobId,
      leaseId: lease.leaseId,
      credentialScopes: lease.credentialScopes,
      credentialSetFingerprint: lease.credentialSetFingerprint,
      verdictHash: lease.verdictHash,
      verdictNonce: lease.verdictNonce,
      leaseNonce: lease.nonce,
      verifiedAt: now,
    }),
  };
};

const readString = (
  input: Record<string, unknown>,
  key: string,
  findings: string[],
): string => {
  const value = input[key];
  if (typeof value === "string") return value;
  findings.push(`Credential lease ${key} must be a string`);
  return "";
};

const readTime = (
  input: Record<string, unknown>,
  key: string,
  findings: string[],
): number => {
  const value = input[key];
  if (Number.isSafeInteger(value) && (value as number) >= 0) {
    return value as number;
  }
  findings.push(`Credential lease ${key} must be a nonnegative safe integer`);
  return 0;
};

const parseCredentialScopes = (
  input: unknown,
  findings: string[],
): readonly string[] => {
  if (!Array.isArray(input) || input.length === 0) {
    findings.push("Credential lease scopes must be a non-empty array");
    return Object.freeze([]);
  }
  const values = input.flatMap((value, index) => {
    if (typeof value !== "string" || !scope.test(value)) {
      findings.push(`Credential lease scope ${index} is invalid`);
      return [];
    }
    return [value];
  });
  if (new Set(values).size !== values.length) {
    findings.push("Credential lease scopes contain duplicates");
  }
  const sorted = [...values].sort(compareAscii);
  if (values.some((value, index) => value !== sorted[index])) {
    findings.push("Credential lease scopes must be in canonical order");
  }
  return Object.freeze(values);
};

const leaseBindingFindings = (
  lease: DeployCredentialLeaseAttestation,
  verdict: PromotionVerdict,
  expected: DeployCredentialLeaseAttestation,
): string[] => {
  const findings: string[] = [];
  for (const key of [
    "schemaVersion",
    "kind",
    "jobClass",
    "jobId",
    "leaseId",
    "environment",
    "targetId",
    "credentialSetFingerprint",
    "verdictHash",
    "verdictNonce",
    "issuedAt",
    "expiresAt",
    "nonce",
  ] as const) {
    if (lease[key] !== expected[key]) findings.push(`${key} does not match`);
  }
  if (
    JSON.stringify(lease.credentialScopes) !==
    JSON.stringify(expected.credentialScopes)
  ) {
    findings.push("credentialScopes do not match exactly");
  }
  if (lease.environment !== verdict.toEnvironment) {
    findings.push("Credential lease environment does not match the verdict");
  }
  if (lease.targetId !== verdict.targetId) {
    findings.push("Credential lease target does not match the verdict");
  }
  if (lease.verdictHash !== verdict.canonicalHash) {
    findings.push("Credential lease hash does not match the verdict");
  }
  if (lease.verdictNonce !== verdict.nonce) {
    findings.push("Credential lease nonce binding does not match the verdict");
  }
  return findings;
};

const contains = (
  values: ReadonlySet<string> | readonly string[] | undefined,
  value: string,
): boolean =>
  values === undefined
    ? false
    : Array.isArray(values)
      ? values.includes(value)
      : (values as ReadonlySet<string>).has(value);

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
