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
};

export type AdmissionAttestation = JourneyRunningIdentity & {
  readonly protocolVersion: 1;
  readonly dependencyAttestationIds: readonly string[];
  readonly issuer: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly payload: Uint8Array;
  readonly signature: Uint8Array;
};

export type AttestationVerifier = {
  readonly verify: (
    payload: Uint8Array,
    signature: Uint8Array,
    attestation: AdmissionAttestation,
  ) => boolean;
};

export type AttestationIssuer = {
  readonly issue: (
    attestation: Omit<AdmissionAttestation, "signature">,
  ) => Uint8Array;
};

export type AdmissionVerificationReason =
  | "UNTRUSTED_ISSUER"
  | "LOCAL_ISSUER_FORBIDDEN"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "REPOSITORY_MISMATCH"
  | "COMMIT_MISMATCH"
  | "JOURNEY_MISMATCH"
  | "JOURNEY_HASH_MISMATCH"
  | "CONTRACT_MISMATCH"
  | "TEST_MISMATCH"
  | "GENERATED_IDENTITY_MISMATCH"
  | "DEPLOYMENT_MISMATCH";

export type AdmissionVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: AdmissionVerificationReason };

const mismatch = (
  attestation: AdmissionAttestation,
  identity: JourneyRunningIdentity,
): AdmissionVerificationReason | undefined => {
  const fields: readonly [
    keyof JourneyRunningIdentity,
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
  ];
  return fields.find(([field]) => attestation[field] !== identity[field])?.[1];
};

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
  if (!verifier.verify(attestation.payload, attestation.signature, attestation))
    return { ok: false, reason: "INVALID_SIGNATURE" };
  if (Date.parse(attestation.expiresAt) <= now.getTime())
    return { ok: false, reason: "EXPIRED" };
  const reason = mismatch(attestation, identity);
  return reason === undefined ? { ok: true } : { ok: false, reason };
};
