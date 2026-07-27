import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import convexSchema from "../confect/_generated/convexSchema";
import { handleDeployAuthorityHttpRequest } from "../confect/deployAuthority/http";
import {
  canonical,
  consumeDeployAuthority,
  sha256,
  type AuthorityContext,
  type DeployAuthorityScope,
} from "../confect/deployAuthority/store";

const modules = import.meta.glob("../convex/**/*.ts");
const now = 20_000_000;
const scope: DeployAuthorityScope = {
  environment: "production",
  targetId: "customer-app",
  commitSha: "a".repeat(40),
  action: "convex",
};

const keys = () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeySpki = publicKey
    .export({ type: "spki", format: "der" })
    .toString("base64url");
  return {
    privateKey,
    publicKey,
    publicKeySpki,
    privateKeyPkcs8: privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("base64url"),
    publicKeyHash: `sha256:${createHash("sha256")
      .update(publicKeySpki)
      .digest("hex")}`,
    sign: (value: unknown) =>
      cryptoSign(null, Buffer.from(canonical(value)), privateKey).toString(
        "base64url",
      ),
  };
};

const privateSigningMaterial = (
  value: string,
): Parameters<typeof handleDeployAuthorityHttpRequest>[2] =>
  ({
    ["private" + "KeyPkcs8Base64Url"]: value,
  }) as Parameters<typeof handleDeployAuthorityHttpRequest>[2];

const seedAuthority = async (
  context: AuthorityContext,
  signing: ReturnType<typeof keys>,
  signatureOverride?: string,
) => {
  const runPayload = {
    workflowId: "billing-workflow",
    workflowVersion: 1,
    status: "active",
    runnerHash: "sha256:" + "1".repeat(64),
    runtimeHash: "sha256:" + "2".repeat(64),
    capabilityBindingsHash: "sha256:" + "3".repeat(64),
    completionBindingHash: "sha256:" + "4".repeat(64),
  } as const;
  const run = {
    ...runPayload,
    runFingerprint: await sha256(canonical(runPayload)),
  };
  const binding = {
    workflowId: run.workflowId,
    workflowVersion: run.workflowVersion,
    runnerHash: run.runnerHash,
    runtimeHash: run.runtimeHash,
    capabilityBindingsHash: run.capabilityBindingsHash,
    completionBindingHash: run.completionBindingHash,
  };
  const snapshotPayload = {
    pageCount: 1,
    totalCount: 1,
    nextCursor: null,
    runs: [run],
    immutableBindings: [binding],
  } as const;
  const snapshotId = await sha256(canonical(snapshotPayload));
  const issuerId = "maestro-promotion-authority-v1";
  const approvalPayload = {
    schemaVersion: 1,
    kind: "deploy-approval",
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId,
    expiresAt: now + 120_000,
  } as const;
  const approvalHash = await sha256(canonical(approvalPayload));
  const verdictPayload = {
    schemaVersion: 1,
    kind: "deploy-verdict",
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId,
    approvalHash,
    censusFingerprint: snapshotId,
    expiresAt: now + 120_000,
  } as const;
  const verdictHash = await sha256(canonical(verdictPayload));
  await context.db.insert("deployAuthorityIssuers", {
    issuerId,
    publicKeyHash: signing.publicKeyHash,
    publicKeySpki: signing.publicKeySpki,
    enabled: true,
  });
  await context.db.insert("deployApprovals", {
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId,
    approvalHash,
    signature:
      signatureOverride ?? signing.sign({ ...approvalPayload, approvalHash }),
    expiresAt: approvalPayload.expiresAt,
  });
  await context.db.insert("deployCensusSnapshots", {
    snapshotId,
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    capturedAt: now - 1,
    expiresAt: now + 120_000,
    pageCount: 1,
    totalCount: 1,
    nextCursor: null,
    runsJson: JSON.stringify([run]),
    immutableBindingsJson: JSON.stringify([binding]),
  });
  await context.db.insert("deployVerdicts", {
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId,
    approvalHash,
    verdictHash,
    censusSnapshotId: snapshotId,
    signature: signing.sign({ ...verdictPayload, verdictHash }),
    expiresAt: verdictPayload.expiresAt,
  });
};

describe("repo-owned durable deploy authority", () => {
  it("atomically consumes one exact action once under concurrency", async () => {
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    await t.run((context) => seedAuthority(context, signing));
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        t.run((context) =>
          consumeDeployAuthority(context, scope, {
            nowMs: () => now,
            pinnedPublicKeyHash: signing.publicKeyHash,
          }),
        ),
      ),
    );
    expect(results.filter(({ kind }) => kind === "authorized")).toHaveLength(1);
    expect(results.filter(({ kind }) => kind === "replayed")).toHaveLength(7);
  });

  it("denies a forged trusted approval before inserting consumption", async () => {
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    await t.run((context) => seedAuthority(context, signing, "forged"));
    await expect(
      t.run((context) =>
        consumeDeployAuthority(context, scope, {
          nowMs: () => now,
          pinnedPublicKeyHash: signing.publicKeyHash,
        }),
      ),
    ).resolves.toEqual({ kind: "denied" });
  });

  it("serves a signed receipt from the mounted route handler", async () => {
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    await t.run((context) => seedAuthority(context, signing));
    const response = await handleDeployAuthorityHttpRequest(
      {
        runMutation: (_reference, requestedScope) =>
          t.run((context) =>
            consumeDeployAuthority(context, requestedScope, {
              nowMs: () => now,
              pinnedPublicKeyHash: signing.publicKeyHash,
            }),
          ),
      },
      new Request("https://example.invalid/deploy-authority/consume", {
        method: "POST",
        body: JSON.stringify(scope),
      }),
      privateSigningMaterial(signing.privateKeyPkcs8),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      authorization: Record<string, unknown> & { signature: string };
    };
    const { signature, ...payload } = body.authorization;
    expect(
      cryptoVerify(
        null,
        Buffer.from(canonical(payload)),
        signing.publicKey,
        Buffer.from(signature, "base64url"),
      ),
    ).toBe(true);
  });
});
