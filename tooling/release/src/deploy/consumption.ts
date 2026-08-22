import {
  verifyDeployAuthority,
  type DeployAuthorityExpectation,
  type DeployAuthorityVerification,
} from "./authority.js";

export type AtomicNonceConsumption = {
  readonly namespace: "promotion-deploy" | "promotion-decision";
  readonly identities: readonly string[];
  readonly environment: string;
  readonly targetId: string;
  readonly consumedAt: number;
};

/** Implement with one transaction and unique indexes over every identity. */
export type AtomicNonceConsumer = {
  readonly consumeExactlyOnce: (
    input: AtomicNonceConsumption,
  ) => Promise<{ readonly kind: "consumed" } | { readonly kind: "replayed" }>;
};

export const verifyAndConsumeDeployAuthority = async (
  input: { readonly verdict: unknown; readonly lease: unknown },
  expected: DeployAuthorityExpectation,
  dependencies: {
    readonly nowMs: () => number;
    readonly nonceConsumer: AtomicNonceConsumer;
  },
): Promise<DeployAuthorityVerification> => {
  const now = dependencies.nowMs();
  const verified = verifyDeployAuthority(input, expected, { nowMs: () => now });
  if (!verified.ok) return verified;
  const consumed = await dependencies.nonceConsumer.consumeExactlyOnce({
    namespace: "promotion-deploy",
    identities: Object.freeze([
      verified.authorization.verdictNonce,
      verified.authorization.leaseNonce,
    ]),
    environment: verified.authorization.environment,
    targetId: verified.authorization.targetId,
    consumedAt: now,
  });
  return consumed.kind === "consumed"
    ? verified
    : {
        ok: false,
        code: "lease-replayed",
        findings: Object.freeze([
          "Promotion verdict or credential lease was consumed concurrently.",
        ]),
      };
};
