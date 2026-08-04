export type BackendRuntimeIdentity = {
  readonly inputDigest: `sha256:${string}`;
  readonly deploymentId: string;
  readonly startNonce: string;
};

const canonical = (identity: BackendRuntimeIdentity): string =>
  JSON.stringify({
    inputDigest: identity.inputDigest,
    deploymentId: identity.deploymentId,
    startNonce: identity.startNonce,
  });

export function assertRuntimeIdentityEquality(input: {
  readonly expected: BackendRuntimeIdentity;
  readonly controller: BackendRuntimeIdentity;
  readonly web: BackendRuntimeIdentity;
  readonly cli: BackendRuntimeIdentity;
}): BackendRuntimeIdentity {
  const expected = canonical(input.expected);
  for (const [observer, identity] of Object.entries({
    controller: input.controller,
    web: input.web,
    cli: input.cli,
  })) {
    if (canonical(identity) !== expected)
      throw new Error(
        `${observer} backend identity differs from runtime manifest.`,
      );
  }
  return { ...input.expected };
}
