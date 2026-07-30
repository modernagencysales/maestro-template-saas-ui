import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { runDurableDeployAuthorityPreflight } from "./authorityCli.js";
import {
  handleDurableDeployAuthority,
  PINNED_DEPLOY_AUTHORITY_ISSUER_ID,
  requestDurableDeployAuthorization,
  type DeployAuthorityAction,
  type DurableDeployAuthorizationPayload,
  type DurableDeployScope,
  type DurablePromotionAuthorityStore,
} from "./durableAuthority.js";

const now = 10_000_000;
const digest = (character: string) => `sha256:${character.repeat(64)}`;
const scope = (
  action: DeployAuthorityAction = "convex",
): DurableDeployScope => ({
  environment: "production",
  targetId: "customer-app",
  commitSha: "a".repeat(40),
  action,
});

const payload = (
  value: DurableDeployScope,
  overrides: Partial<DurableDeployAuthorizationPayload> = {},
): DurableDeployAuthorizationPayload => ({
  schemaVersion: 1,
  kind: "durable-deploy-authorization",
  ...value,
  issuerId: PINNED_DEPLOY_AUTHORITY_ISSUER_ID,
  verdictHash: digest("b"),
  approvalHash: digest("c"),
  censusFingerprint: digest("d"),
  consumptionId: `consume_${value.action}_0001`,
  issuedAt: now,
  expiresAt: now + 30_000,
  ...overrides,
});

const keys = () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    sign: async (canonicalPayload: string) =>
      cryptoSign(null, Buffer.from(canonicalPayload), privateKey).toString(
        "base64url",
      ),
  };
};

const transactionalStore = (): DurablePromotionAuthorityStore => {
  const consumed = new Set<string>();
  return {
    authorizeAndConsume: async (value) => {
      const key = `${value.environment}:${value.targetId}:${value.commitSha}:${value.action}`;
      if (consumed.has(key)) return { kind: "replayed" as const };
      consumed.add(key);
      await Promise.resolve();
      return { kind: "authorized" as const, payload: payload(value) };
    },
  };
};

const responseFetch = (
  response: Awaited<ReturnType<typeof handleDurableDeployAuthority>>,
): typeof fetch =>
  vi.fn(
    async () =>
      new Response(JSON.stringify(response), {
        status: response.kind === "ok" ? 200 : 403,
        headers: { "content-type": "application/json" },
      }),
  ) as unknown as typeof fetch;

describe("durable deploy authority", () => {
  it("atomically permits only one concurrent consume for the same action", async () => {
    const signing = keys();
    const store = transactionalStore();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        handleDurableDeployAuthority(scope("convex"), {
          store,
          sign: signing.sign,
        }),
      ),
    );
    expect(results.filter(({ kind }) => kind === "ok")).toHaveLength(1);
    expect(results.filter(({ kind }) => kind === "blocked")).toHaveLength(7);
  });

  it("consumes convex and cloudflare independently exactly once", async () => {
    const signing = keys();
    const store = transactionalStore();
    for (const action of ["convex", "cloudflare"] as const) {
      await expect(
        handleDurableDeployAuthority(scope(action), {
          store,
          sign: signing.sign,
        }),
      ).resolves.toMatchObject({ kind: "ok" });
      await expect(
        handleDurableDeployAuthority(scope(action), {
          store,
          sign: signing.sign,
        }),
      ).resolves.toEqual({ kind: "blocked" });
    }
  });

  it("verifies an ephemeral Ed25519 receipt end to end", async () => {
    const signing = keys();
    const requested = scope("preflight");
    const server = await handleDurableDeployAuthority(requested, {
      store: transactionalStore(),
      sign: signing.sign,
    });
    await expect(
      requestDurableDeployAuthorization(requested, {
        endpoint: "https://authority.invalid/",
        publicKeyPem: signing.publicKeyPem,
        nowMs: () => now + 1,
        fetch: responseFetch(server),
      }),
    ).resolves.toMatchObject(requested);
  });

  it("rejects forged signatures and a signed unpinned issuer", async () => {
    const signing = keys();
    const requested = scope();
    const valid = await handleDurableDeployAuthority(requested, {
      store: transactionalStore(),
      sign: signing.sign,
    });
    if (valid.kind !== "ok") throw new Error("fixture must authorize");
    const forged = {
      ...valid,
      authorization: { ...valid.authorization, signature: "forged" },
    } as const;
    await expect(
      requestDurableDeployAuthorization(requested, {
        endpoint: "https://authority.invalid",
        publicKeyPem: signing.publicKeyPem,
        nowMs: () => now + 1,
        fetch: responseFetch(forged),
      }),
    ).rejects.toThrow(/signature/);

    const wrongIssuer = await handleDurableDeployAuthority(requested, {
      store: {
        authorizeAndConsume: async (value) => ({
          kind: "authorized",
          payload: payload(value, { issuerId: "caller-selected-issuer" }),
        }),
      },
      sign: signing.sign,
    });
    expect(wrongIssuer).toEqual({ kind: "blocked" });
  });

  it("fails closed without an endpoint and never calls fetch", async () => {
    const signing = keys();
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    await expect(
      requestDurableDeployAuthorization(scope(), {
        endpoint: undefined,
        publicKeyPem: signing.publicKeyPem,
        nowMs: () => now,
        fetch: fetchSpy,
      }),
    ).rejects.toThrow(/unavailable/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts only an HTTPS base endpoint without credentials or URL suffixes", async () => {
    const signing = keys();
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    for (const endpoint of [
      "http://authority.invalid",
      "https://user:pass@authority.invalid",
      "https://authority.invalid/control-plane",
      "https://authority.invalid?tenant=template",
      "https://authority.invalid#fragment",
      "not-a-url",
    ]) {
      await expect(
        requestDurableDeployAuthorization(scope(), {
          endpoint,
          publicKeyPem: signing.publicKeyPem,
          nowMs: () => now,
          fetch: fetchSpy,
        }),
      ).rejects.toThrow(/HTTPS base URL/);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks a target-coupled preflight before any network request", async () => {
    const signing = keys();
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    await expect(
      runDurableDeployAuthorityPreflight(
        [
          "staging",
          "a".repeat(40),
          "template-staging",
          "https://target-deployment.convex.cloud",
        ],
        {
          endpoint: "https://target-deployment.convex.cloud",
          publicKeyPem: signing.publicKeyPem,
          nowMs: () => now,
          fetch: fetchSpy,
        },
      ),
    ).rejects.toThrow(/independent HTTPS base URL/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks matching Convex cloud and site deployment identities without network", async () => {
    const signing = keys();
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    for (const [endpoint, targetConvexUrl] of [
      [
        "https://exciting-cat-536.convex.site",
        "https://exciting-cat-536.convex.cloud",
      ],
      [
        "https://exciting-cat-536.convex.cloud",
        "https://exciting-cat-536.convex.site",
      ],
      [
        "https://EXCITING-CAT-536.CONVEX.SITE",
        "https://Exciting-Cat-536.Convex.Cloud",
      ],
    ] as const) {
      await expect(
        runDurableDeployAuthorityPreflight(
          ["staging", "a".repeat(40), "template-staging", targetConvexUrl],
          {
            endpoint,
            publicKeyPem: signing.publicKeyPem,
            nowMs: () => now,
            fetch: fetchSpy,
          },
        ),
      ).rejects.toThrow(/independent HTTPS base URL/);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows distinct Convex deployment identities", async () => {
    const signing = keys();
    const requested = scope("preflight");
    const server = await handleDurableDeployAuthority(requested, {
      store: transactionalStore(),
      sign: signing.sign,
    });
    const fetchSpy = responseFetch(server);
    await expect(
      runDurableDeployAuthorityPreflight(
        [
          requested.environment,
          requested.commitSha,
          requested.targetId,
          "https://target-deployment.convex.cloud",
        ],
        {
          endpoint: "https://independent-authority.convex.site",
          publicKeyPem: signing.publicKeyPem,
          nowMs: () => now + 1,
          fetch: fetchSpy,
        },
      ),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("rejects every exact-scope field mismatch", async () => {
    const signing = keys();
    const requested = scope("convex");
    for (const issued of [
      { ...requested, environment: "staging" as const },
      { ...requested, targetId: "other-app" },
      { ...requested, commitSha: "e".repeat(40) },
      { ...requested, action: "cloudflare" as const },
    ]) {
      const server = await handleDurableDeployAuthority(issued, {
        store: transactionalStore(),
        sign: signing.sign,
      });
      await expect(
        requestDurableDeployAuthorization(requested, {
          endpoint: "https://authority.invalid",
          publicKeyPem: signing.publicKeyPem,
          nowMs: () => now + 1,
          fetch: responseFetch(server),
        }),
      ).rejects.toThrow();
    }
  });

  it("blocks store failure and malformed or scope-drifted store payloads", async () => {
    const signing = keys();
    await expect(
      handleDurableDeployAuthority(scope(), {
        store: {
          authorizeAndConsume: async () => {
            throw new Error("store unavailable");
          },
        },
        sign: signing.sign,
      }),
    ).resolves.toEqual({ kind: "blocked" });
    await expect(
      handleDurableDeployAuthority(scope(), {
        store: {
          authorizeAndConsume: async (value) => ({
            kind: "authorized",
            payload: payload({ ...value, targetId: "other-app" }),
          }),
        },
        sign: signing.sign,
      }),
    ).resolves.toEqual({ kind: "blocked" });
  });
});
