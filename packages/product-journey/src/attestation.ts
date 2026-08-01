export type JourneyRunningIdentity = {
  readonly repository: string;
  readonly commitSha: string;
  readonly journeyId: string;
  readonly journeyVersion: number;
  readonly journeyHash: string;
  readonly contractHash: string;
  readonly testHash: string;
  readonly generatedIdentity: string;
  readonly deploymentIdentity: string;
  readonly environment: string;
  readonly runtimeConfigDigest: string;
  readonly evidenceReportDigest: string;
  readonly requiredScenarioIds: readonly string[];
  readonly dependencyAttestationIds: readonly string[];
};

export type AdmissionClaims = JourneyRunningIdentity & {
  readonly protocolVersion: 1;
  readonly issuer: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly passedScenarioIds: readonly string[];
  readonly skippedScenarioIds: readonly string[];
  readonly notReachedScenarioIds: readonly string[];
};

export type AdmissionAttestation = AdmissionClaims & {
  readonly signature: Uint8Array;
};

export type AttestationVerifier = {
  readonly verify: (claims: Uint8Array, signature: Uint8Array) => boolean;
};

export type AttestationIssuer = {
  readonly issue: (claims: Uint8Array) => Uint8Array;
};

export type AdmissionVerificationReason =
  | "UNTRUSTED_ISSUER"
  | "LOCAL_ISSUER_FORBIDDEN"
  | "INVALID_SIGNATURE"
  | "INVALID_TIME"
  | "NOT_YET_VALID"
  | "EXPIRED"
  | "REPOSITORY_MISMATCH"
  | "COMMIT_MISMATCH"
  | "JOURNEY_MISMATCH"
  | "JOURNEY_HASH_MISMATCH"
  | "CONTRACT_MISMATCH"
  | "TEST_MISMATCH"
  | "GENERATED_IDENTITY_MISMATCH"
  | "DEPLOYMENT_MISMATCH"
  | "DEPENDENCY_MISMATCH"
  | "RUNTIME_CONFIG_DIGEST_INVALID"
  | "RUNTIME_CONFIG_MISMATCH"
  | "EVIDENCE_REPORT_DIGEST_INVALID"
  | "EVIDENCE_REPORT_MISMATCH"
  | "REQUIRED_SCENARIOS_MISMATCH"
  | "SCENARIO_CLOSURE_INCOMPLETE";

export type AdmissionVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: AdmissionVerificationReason };

const claimsOf = (value: AdmissionClaims): AdmissionClaims => ({
  protocolVersion: value.protocolVersion,
  repository: value.repository,
  commitSha: value.commitSha,
  journeyId: value.journeyId,
  journeyVersion: value.journeyVersion,
  journeyHash: value.journeyHash,
  contractHash: value.contractHash,
  testHash: value.testHash,
  generatedIdentity: value.generatedIdentity,
  deploymentIdentity: value.deploymentIdentity,
  environment: value.environment,
  runtimeConfigDigest: value.runtimeConfigDigest,
  evidenceReportDigest: value.evidenceReportDigest,
  requiredScenarioIds: value.requiredScenarioIds,
  dependencyAttestationIds: value.dependencyAttestationIds,
  issuer: value.issuer,
  issuedAt: value.issuedAt,
  expiresAt: value.expiresAt,
  passedScenarioIds: value.passedScenarioIds,
  skippedScenarioIds: value.skippedScenarioIds,
  notReachedScenarioIds: value.notReachedScenarioIds,
});

export const canonicalAdmissionClaims = (claims: AdmissionClaims): Uint8Array =>
  new TextEncoder().encode(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(claimsOf(claims)).sort(([left], [right]) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
      ),
    ),
  );

const sameStrings = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const sameStringSet = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  new Set(left).size === left.length &&
  new Set(right).size === right.length &&
  left.length === right.length &&
  left.every((value) => right.includes(value));

const mismatch = (
  attestation: AdmissionAttestation,
  identity: JourneyRunningIdentity,
): AdmissionVerificationReason | undefined => {
  const fields: readonly [
    keyof Omit<JourneyRunningIdentity, "dependencyAttestationIds">,
    AdmissionVerificationReason,
  ][] = [
    ["repository", "REPOSITORY_MISMATCH"],
    ["commitSha", "COMMIT_MISMATCH"],
    ["journeyId", "JOURNEY_MISMATCH"],
    ["journeyVersion", "JOURNEY_MISMATCH"],
    ["journeyHash", "JOURNEY_HASH_MISMATCH"],
    ["contractHash", "CONTRACT_MISMATCH"],
    ["testHash", "TEST_MISMATCH"],
    ["generatedIdentity", "GENERATED_IDENTITY_MISMATCH"],
    ["deploymentIdentity", "DEPLOYMENT_MISMATCH"],
    ["environment", "DEPLOYMENT_MISMATCH"],
  ];
  const fieldReason = fields.find(
    ([field]) => attestation[field] !== identity[field],
  )?.[1];
  if (fieldReason !== undefined) return fieldReason;
  if (attestation.runtimeConfigDigest !== identity.runtimeConfigDigest)
    return "RUNTIME_CONFIG_MISMATCH";
  if (attestation.evidenceReportDigest !== identity.evidenceReportDigest)
    return "EVIDENCE_REPORT_MISMATCH";
  if (
    !sameStringSet(
      attestation.requiredScenarioIds,
      identity.requiredScenarioIds,
    )
  )
    return "REQUIRED_SCENARIOS_MISMATCH";
  return sameStrings(
    attestation.dependencyAttestationIds,
    identity.dependencyAttestationIds,
  )
    ? undefined
    : "DEPENDENCY_MISMATCH";
};

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

export const verifyAdmissionAttestation = (
  attestation: AdmissionAttestation,
  identity: JourneyRunningIdentity,
  trustedIssuers: Readonly<Record<string, AttestationVerifier>>,
  now: Date = new Date(),
): AdmissionVerification => {
  if (attestation.issuer === "local" && identity.environment !== "local")
    return { ok: false, reason: "LOCAL_ISSUER_FORBIDDEN" };
  const verifier = trustedIssuers[attestation.issuer];
  if (verifier === undefined) return { ok: false, reason: "UNTRUSTED_ISSUER" };
  if (
    !verifier.verify(
      canonicalAdmissionClaims(attestation),
      attestation.signature,
    )
  )
    return { ok: false, reason: "INVALID_SIGNATURE" };

  const issuedAt = Date.parse(attestation.issuedAt);
  const expiresAt = Date.parse(attestation.expiresAt);
  const nowMs = now.getTime();
  if (
    ![issuedAt, expiresAt, nowMs].every(Number.isFinite) ||
    issuedAt > expiresAt
  )
    return { ok: false, reason: "INVALID_TIME" };
  if (issuedAt > nowMs + MAX_FUTURE_SKEW_MS)
    return { ok: false, reason: "NOT_YET_VALID" };
  if (expiresAt <= nowMs) return { ok: false, reason: "EXPIRED" };

  if (
    !digestPattern.test(attestation.runtimeConfigDigest) ||
    !digestPattern.test(identity.runtimeConfigDigest)
  )
    return { ok: false, reason: "RUNTIME_CONFIG_DIGEST_INVALID" };
  if (
    !digestPattern.test(attestation.evidenceReportDigest) ||
    !digestPattern.test(identity.evidenceReportDigest)
  )
    return { ok: false, reason: "EVIDENCE_REPORT_DIGEST_INVALID" };
  if (
    !isStringArray(attestation.requiredScenarioIds) ||
    !isStringArray(attestation.passedScenarioIds) ||
    !isStringArray(attestation.skippedScenarioIds) ||
    !isStringArray(attestation.notReachedScenarioIds)
  )
    return { ok: false, reason: "SCENARIO_CLOSURE_INCOMPLETE" };
  if (!isStringArray(identity.requiredScenarioIds))
    return { ok: false, reason: "REQUIRED_SCENARIOS_MISMATCH" };
  if (
    !isStringArray(attestation.dependencyAttestationIds) ||
    !isStringArray(identity.dependencyAttestationIds)
  )
    return { ok: false, reason: "DEPENDENCY_MISMATCH" };
  if (
    attestation.skippedScenarioIds.length !== 0 ||
    attestation.notReachedScenarioIds.length !== 0 ||
    !sameStringSet(
      attestation.requiredScenarioIds,
      attestation.passedScenarioIds,
    )
  )
    return { ok: false, reason: "SCENARIO_CLOSURE_INCOMPLETE" };

  const reason = mismatch(attestation, identity);
  return reason === undefined ? { ok: true } : { ok: false, reason };
};
