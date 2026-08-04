export type BackendRuntimeIdentity = {
  readonly inputDigest: `sha256:${string}`;
  readonly deploymentId: string;
  readonly startNonce: string;
};

export type RuntimeIdentitySeed = Omit<BackendRuntimeIdentity, "startNonce"> & {
  readonly randomUUID: () => string;
};

const callerIdentityFields = new Set([
  "deploymentId",
  "expectedSha",
  "inputDigest",
  "startNonce",
  "timestamp",
]);

export const createRuntimeIdentity = (
  input: RuntimeIdentitySeed,
): BackendRuntimeIdentity => {
  if (!/^sha256:[0-9a-f]{64}$/u.test(input.inputDigest))
    throw new Error("Runtime input digest is invalid.");
  if (input.deploymentId.trim() === "")
    throw new Error("Runtime deployment identity is invalid.");
  const startNonce = input.randomUUID();
  if (startNonce.trim() === "")
    throw new Error("Runtime start nonce is invalid.");
  return {
    deploymentId: input.deploymentId,
    inputDigest: input.inputDigest,
    startNonce,
  };
};

/** The identity is server-owned; reads never accept an expected value. */
export const readRuntimeIdentity = (
  identity: BackendRuntimeIdentity,
  callerInput: Readonly<Record<string, unknown>>,
): BackendRuntimeIdentity => {
  if (Object.keys(callerInput).some((key) => callerIdentityFields.has(key)))
    throw new Error("Runtime identity does not accept caller identity fields.");
  return { ...identity };
};
