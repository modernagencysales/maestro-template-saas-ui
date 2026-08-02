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

export type VerifiedAdmissionProjection = {
  readonly attestationId: string;
  readonly runtimeIdentityHash: string;
  readonly evidenceHash: string;
  readonly expiresAt: string;
  readonly dependencyAttestationIds: readonly string[];
};

const verifiedAdmissionProjections = new WeakSet<object>();

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
  | "SCENARIO_CLOSURE_INCOMPLETE"
  | "INVALID_ATTESTATION";

export type AdmissionVerification =
  | { readonly ok: true; readonly verified: VerifiedAdmissionProjection }
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
  attestation: AdmissionClaims,
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
  Array.isArray(value) &&
  value.every((entry) => typeof entry === "string" && entry.length > 0);
const isUniqueStringArray = (value: unknown): value is readonly string[] =>
  isStringArray(value) && new Set(value).size === value.length;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const scalarClaimKeys = [
  "repository",
  "commitSha",
  "journeyId",
  "journeyHash",
  "contractHash",
  "testHash",
  "generatedIdentity",
  "deploymentIdentity",
  "environment",
  "issuer",
  "issuedAt",
  "expiresAt",
] as const;

const arrayClaimKeys = [
  "requiredScenarioIds",
  "dependencyAttestationIds",
  "passedScenarioIds",
  "skippedScenarioIds",
  "notReachedScenarioIds",
] as const;
const attestationKeys = [
  "protocolVersion",
  "journeyVersion",
  ...scalarClaimKeys,
  "runtimeConfigDigest",
  "evidenceReportDigest",
  ...arrayClaimKeys,
  "signature",
] as const;

type AttestationSnapshot = AdmissionClaims & {
  readonly signature: readonly number[];
};

const cloneStringArray = (value: unknown): unknown =>
  Array.isArray(value) ? Object.freeze(Array.from(value)) : value;

const snapshotAttestation = (
  value: unknown,
): AttestationSnapshot | undefined => {
  if (!isRecord(value)) return undefined;
  const read = Object.create(null) as Record<string, unknown>;
  for (const key of attestationKeys) {
    if (!hasOwn(value, key)) return undefined;
    read[key] = value[key];
  }
  const signature = read.signature;
  if (!(signature instanceof Uint8Array)) return undefined;
  for (const key of arrayClaimKeys) read[key] = cloneStringArray(read[key]);
  read.signature = Object.freeze(Array.from(signature));
  return Object.freeze(read) as AttestationSnapshot;
};

const hasValidSnapshotBase = (
  value: AttestationSnapshot,
): value is AttestationSnapshot =>
  value.protocolVersion === 1 &&
  Number.isSafeInteger(value.journeyVersion) &&
  value.journeyVersion > 0 &&
  value.signature.every(
    (entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255,
  ) &&
  scalarClaimKeys.every(
    (key) => typeof value[key] === "string" && value[key].length > 0,
  );

const identityKeys = [
  "repository",
  "commitSha",
  "journeyId",
  "journeyVersion",
  "journeyHash",
  "contractHash",
  "testHash",
  "generatedIdentity",
  "deploymentIdentity",
  "environment",
  "runtimeConfigDigest",
  "evidenceReportDigest",
  "requiredScenarioIds",
  "dependencyAttestationIds",
] as const;

const snapshotIdentity = (
  value: unknown,
): JourneyRunningIdentity | undefined => {
  if (!isRecord(value)) return undefined;
  const read = Object.create(null) as Record<string, unknown>;
  for (const key of identityKeys) {
    if (!hasOwn(value, key)) return undefined;
    read[key] = value[key];
  }
  read.requiredScenarioIds = cloneStringArray(read.requiredScenarioIds);
  read.dependencyAttestationIds = cloneStringArray(
    read.dependencyAttestationIds,
  );
  return Object.freeze(read) as JourneyRunningIdentity;
};

const identityOf = (
  value: JourneyRunningIdentity,
): Readonly<Record<string, unknown>> => ({ ...value });

const canonicalRecord = (
  value: Readonly<Record<string, unknown>>,
): Uint8Array =>
  new TextEncoder().encode(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(value).sort(([left], [right]) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
      ),
    ),
  );

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

const createVerifiedProjection = (
  attestation: AttestationSnapshot,
  identity: JourneyRunningIdentity,
  canonicalClaims: Uint8Array,
): VerifiedAdmissionProjection => {
  const projection: VerifiedAdmissionProjection = Object.freeze({
    attestationId: `claims:${toHex(canonicalClaims)}`,
    runtimeIdentityHash: `identity:${toHex(canonicalRecord(identityOf(identity)))}`,
    evidenceHash: attestation.evidenceReportDigest,
    expiresAt: attestation.expiresAt,
    dependencyAttestationIds: Object.freeze([
      ...attestation.dependencyAttestationIds,
    ]),
  });
  verifiedAdmissionProjections.add(projection);
  return projection;
};

export const isVerifiedAdmissionProjection = (
  value: unknown,
): value is VerifiedAdmissionProjection =>
  isRecord(value) &&
  verifiedAdmissionProjections.has(value) &&
  Object.isFrozen(value) &&
  typeof value.attestationId === "string" &&
  typeof value.runtimeIdentityHash === "string" &&
  digestPattern.test(value.evidenceHash as string) &&
  typeof value.expiresAt === "string" &&
  Object.isFrozen(value.dependencyAttestationIds) &&
  isUniqueStringArray(value.dependencyAttestationIds);

export const verifyAdmissionAttestation = (
  attestation: unknown,
  identity: JourneyRunningIdentity,
  trustedIssuers: Readonly<Record<string, AttestationVerifier>>,
  now: Date = new Date(),
): AdmissionVerification => {
  try {
    const snapshot = snapshotAttestation(attestation);
    const runningIdentity = snapshotIdentity(identity);
    if (
      snapshot === undefined ||
      runningIdentity === undefined ||
      !hasValidSnapshotBase(snapshot)
    )
      return { ok: false, reason: "INVALID_ATTESTATION" };
    if (
      !digestPattern.test(snapshot.runtimeConfigDigest) ||
      !digestPattern.test(runningIdentity.runtimeConfigDigest)
    )
      return { ok: false, reason: "RUNTIME_CONFIG_DIGEST_INVALID" };
    if (
      !digestPattern.test(snapshot.evidenceReportDigest) ||
      !digestPattern.test(runningIdentity.evidenceReportDigest)
    )
      return { ok: false, reason: "EVIDENCE_REPORT_DIGEST_INVALID" };
    if (
      !isUniqueStringArray(snapshot.requiredScenarioIds) ||
      !isUniqueStringArray(snapshot.passedScenarioIds) ||
      !isUniqueStringArray(snapshot.skippedScenarioIds) ||
      !isUniqueStringArray(snapshot.notReachedScenarioIds)
    )
      return { ok: false, reason: "SCENARIO_CLOSURE_INCOMPLETE" };
    if (!isUniqueStringArray(runningIdentity.requiredScenarioIds))
      return { ok: false, reason: "REQUIRED_SCENARIOS_MISMATCH" };
    if (
      !isUniqueStringArray(snapshot.dependencyAttestationIds) ||
      !isUniqueStringArray(runningIdentity.dependencyAttestationIds)
    )
      return { ok: false, reason: "DEPENDENCY_MISMATCH" };
    if (snapshot.issuer === "local" && runningIdentity.environment !== "local")
      return { ok: false, reason: "LOCAL_ISSUER_FORBIDDEN" };
    if (!hasOwn(trustedIssuers, snapshot.issuer))
      return { ok: false, reason: "UNTRUSTED_ISSUER" };
    const verifier = trustedIssuers[snapshot.issuer];
    if (verifier === undefined || typeof verifier.verify !== "function")
      return { ok: false, reason: "UNTRUSTED_ISSUER" };
    const canonicalClaims = canonicalAdmissionClaims(snapshot);
    const projectionClaims = canonicalClaims.slice();
    let signatureValid = false;
    try {
      signatureValid =
        verifier.verify(canonicalClaims, new Uint8Array(snapshot.signature)) ===
        true;
    } catch {
      return { ok: false, reason: "INVALID_SIGNATURE" };
    }
    if (!signatureValid) return { ok: false, reason: "INVALID_SIGNATURE" };

    const issuedAt = Date.parse(snapshot.issuedAt);
    const expiresAt = Date.parse(snapshot.expiresAt);
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
      snapshot.skippedScenarioIds.length !== 0 ||
      snapshot.notReachedScenarioIds.length !== 0 ||
      !sameStringSet(snapshot.requiredScenarioIds, snapshot.passedScenarioIds)
    )
      return { ok: false, reason: "SCENARIO_CLOSURE_INCOMPLETE" };

    const reason = mismatch(snapshot, runningIdentity);
    return reason === undefined
      ? {
          ok: true,
          verified: createVerifiedProjection(
            snapshot,
            runningIdentity,
            projectionClaims,
          ),
        }
      : { ok: false, reason };
  } catch {
    return { ok: false, reason: "INVALID_ATTESTATION" };
  }
};
