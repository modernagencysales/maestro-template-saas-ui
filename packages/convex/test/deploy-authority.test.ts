import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import convexSchema from "../confect/_generated/convexSchema";
import { handleDeployAuthorityHttpRequest } from "../confect/deployAuthority/http";
import {
  canonical,
  consumeDeployAuthority,
  runtimeSigningKeyProofPayload,
  sha256,
  type AuthorityContext,
  type DeployAuthorityScope,
} from "../confect/deployAuthority/store";

const modules = import.meta.glob("../convex/**/*.ts");
const now = 20_000_000;
const authorityOrigin = "https://api.workos.com";
const actorHash = "sha256:" + "8".repeat(64);
const provenanceHash = "sha256:" + "7".repeat(64);
const initialPromotionAuthorityMode = process.env.PROMOTION_AUTHORITY_MODE;
const initialPromotionAuthorityPrivateKey =
  process.env.PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL;
const scope: DeployAuthorityScope = {
  environment: "production",
  targetId: "customer-app",
  commitSha: "a".repeat(40),
  action: "convex",
};

const provisionIssuerRef = makeFunctionReference<"mutation">(
  "deploy/authority:provisionIssuer",
);
const rotateIssuerRef = makeFunctionReference<"mutation">(
  "deploy/authority:rotateIssuer",
);
const revokeIssuerRef = makeFunctionReference<"mutation">(
  "deploy/authority:revokeIssuer",
);
const provisionApprovalRef = makeFunctionReference<"mutation">(
  "deploy/authority:provisionApproval",
);
const provisionCensusRef = makeFunctionReference<"mutation">(
  "deploy/authority:provisionCensus",
);
const provisionVerdictRef = makeFunctionReference<"mutation">(
  "deploy/authority:provisionVerdict",
);
const statusRef = makeFunctionReference<"query">("deploy/authority:status");
const readinessRef = makeFunctionReference<"query">(
  "deploy/authority:readiness",
);
const auditExportRef = makeFunctionReference<"query">(
  "deploy/authority:auditExport",
);
const operatorIdentity = {
  subject: "release-operator",
  issuer: authorityOrigin,
  tokenIdentifier: `${authorityOrigin}|release-operator`,
  deploymentAuthorityOperator: true,
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
    authorityMode: "authority",
  }) as Parameters<typeof handleDeployAuthorityHttpRequest>[2];

const storeDependencies = (signing: ReturnType<typeof keys>, clock = now) => ({
  nowMs: () => clock,
  authorityMode: "authority" as const,
  expectedIssuerPublicKeyHash: signing.publicKeyHash,
  runtimeSigningKeyProofSignature: signing.sign(runtimeSigningKeyProofPayload),
});

const makeProvisioningInputs = async (
  signing: ReturnType<typeof keys>,
  clock: number,
  generation = 1,
) => {
  const runPayload = {
    workflowId: "billing-workflow",
    workflowVersion: generation,
    status: "active",
    runnerHash: "sha256:" + String(generation % 10).repeat(64),
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
    issuerPublicKeyHash: signing.publicKeyHash,
    authorityOrigin,
    issuedAt: clock - 1,
    expiresAt: clock + 120_000,
  } as const;
  const approvalHash = await sha256(canonical(approvalPayload));
  const verdictPayload = {
    schemaVersion: 1,
    kind: "deploy-verdict",
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId,
    issuerPublicKeyHash: signing.publicKeyHash,
    authorityOrigin,
    approvalHash,
    censusFingerprint: snapshotId,
    issuedAt: clock - 1,
    expiresAt: clock + 120_000,
  } as const;
  const verdictHash = await sha256(canonical(verdictPayload));
  const sourceReceiptHash = "sha256:" + "9".repeat(64);
  return {
    issuer: {
      issuerId,
      publicKeyHash: signing.publicKeyHash,
      publicKeySpki: signing.publicKeySpki,
      sourceReceiptHash,
    },
    approval: {
      environment: scope.environment,
      targetId: scope.targetId,
      commitSha: scope.commitSha,
      issuerId,
      issuerPublicKeyHash: signing.publicKeyHash,
      approvalHash,
      signature: signing.sign({ ...approvalPayload, approvalHash }),
      issuedAt: approvalPayload.issuedAt,
      expiresAt: approvalPayload.expiresAt,
      sourceReceiptHash,
    },
    census: {
      snapshotId,
      environment: scope.environment,
      targetId: scope.targetId,
      commitSha: scope.commitSha,
      capturedAt: clock - 1,
      expiresAt: clock + 120_000,
      pageCount: 1,
      totalCount: 1,
      nextCursor: null,
      runsJson: JSON.stringify([run]),
      immutableBindingsJson: JSON.stringify([binding]),
      sourceReceiptHash,
    },
    verdict: {
      environment: scope.environment,
      targetId: scope.targetId,
      commitSha: scope.commitSha,
      issuerId,
      issuerPublicKeyHash: signing.publicKeyHash,
      approvalHash,
      verdictHash,
      censusSnapshotId: snapshotId,
      signature: signing.sign({ ...verdictPayload, verdictHash }),
      issuedAt: verdictPayload.issuedAt,
      expiresAt: verdictPayload.expiresAt,
      sourceReceiptHash,
    },
  } as const;
};

const seedAuthority = async (
  context: AuthorityContext,
  signing: ReturnType<typeof keys>,
  signatureOverride?: string,
  options: {
    readonly clock?: number;
    readonly generation?: number;
    readonly includeIssuer?: boolean;
    readonly origin?: string;
  } = {},
) => {
  const clock = options.clock ?? now;
  const generation = options.generation ?? 1;
  const origin = options.origin ?? authorityOrigin;
  const runPayload = {
    workflowId: "billing-workflow",
    workflowVersion: generation,
    status: "active",
    runnerHash: "sha256:" + String(generation % 10).repeat(64),
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
    issuerPublicKeyHash: signing.publicKeyHash,
    authorityOrigin: origin,
    issuedAt: clock - 1,
    expiresAt: clock + 120_000,
  } as const;
  const approvalHash = await sha256(canonical(approvalPayload));
  const verdictPayload = {
    schemaVersion: 1,
    kind: "deploy-verdict",
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId,
    issuerPublicKeyHash: signing.publicKeyHash,
    authorityOrigin: origin,
    approvalHash,
    censusFingerprint: snapshotId,
    issuedAt: clock - 1,
    expiresAt: clock + 120_000,
  } as const;
  const verdictHash = await sha256(canonical(verdictPayload));
  if (options.includeIssuer !== false) {
    await context.db.insert("deployAuthorityIssuers", {
      issuerId,
      publicKeyHash: signing.publicKeyHash,
      publicKeySpki: signing.publicKeySpki,
      enabled: true,
      authorityOrigin: origin,
      activatedAt: clock - 1,
      retiredAt: null,
      provisionedAt: clock - 1,
      provisionedByHash: actorHash,
      provenanceHash,
    });
  }
  await context.db.insert("deployApprovals", {
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId,
    issuerPublicKeyHash: signing.publicKeyHash,
    authorityOrigin: origin,
    approvalHash,
    signature:
      signatureOverride ?? signing.sign({ ...approvalPayload, approvalHash }),
    issuedAt: approvalPayload.issuedAt,
    expiresAt: approvalPayload.expiresAt,
    provisionedAt: clock - 1,
    provisionedByHash: actorHash,
    provenanceHash,
  });
  await context.db.insert("deployCensusSnapshots", {
    snapshotId,
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    capturedAt: clock - 1,
    expiresAt: clock + 120_000,
    pageCount: 1,
    totalCount: 1,
    nextCursor: null,
    runsJson: JSON.stringify([run]),
    immutableBindingsJson: JSON.stringify([binding]),
    authorityOrigin: origin,
    provisionedAt: clock - 1,
    provisionedByHash: actorHash,
    provenanceHash,
  });
  await context.db.insert("deployVerdicts", {
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId,
    issuerPublicKeyHash: signing.publicKeyHash,
    authorityOrigin: origin,
    approvalHash,
    verdictHash,
    censusSnapshotId: snapshotId,
    signature: signing.sign({ ...verdictPayload, verdictHash }),
    issuedAt: verdictPayload.issuedAt,
    expiresAt: verdictPayload.expiresAt,
    provisionedAt: clock - 1,
    provisionedByHash: actorHash,
    provenanceHash,
  });
  return { approvalHash, snapshotId, verdictHash };
};

describe("repo-owned durable deploy authority", () => {
  afterEach(() => {
    if (initialPromotionAuthorityMode === undefined) {
      delete process.env.PROMOTION_AUTHORITY_MODE;
    } else {
      process.env.PROMOTION_AUTHORITY_MODE = initialPromotionAuthorityMode;
    }
    if (initialPromotionAuthorityPrivateKey === undefined) {
      delete process.env.PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL;
    } else {
      process.env.PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL =
        initialPromotionAuthorityPrivateKey;
    }
  });

  it("validates and binds the runtime signing key before one-time consumption", async () => {
    const t = convexTest(convexSchema, modules);
    const activeSigning = keys();
    const unrelatedSigning = keys();
    await t.run((context) => seedAuthority(context, activeSigning));

    let malformedMutationCalls = 0;
    const malformed = await handleDeployAuthorityHttpRequest(
      {
        runQuery: () => {
          throw new Error("malformed key must fail before query");
        },
        runMutation: () => {
          malformedMutationCalls += 1;
          throw new Error("malformed key must fail before mutation");
        },
      },
      new Request("https://example.invalid/deploy-authority/consume", {
        method: "POST",
        body: JSON.stringify(scope),
      }),
      privateSigningMaterial("malformed"),
    );
    expect(malformed.status).toBe(503);
    expect(malformedMutationCalls).toBe(0);

    const unrelated = await handleDeployAuthorityHttpRequest(
      {
        runQuery: async () => ({
          publicKeyHash: activeSigning.publicKeyHash,
          publicKeySpki: activeSigning.publicKeySpki,
          authorityOrigin,
        }),
        runMutation: () => {
          throw new Error("unrelated key must fail before mutation");
        },
      },
      new Request("https://example.invalid/deploy-authority/consume", {
        method: "POST",
        body: JSON.stringify(scope),
      }),
      privateSigningMaterial(unrelatedSigning.privateKeyPkcs8),
    );
    expect(unrelated.status).not.toBe(200);
    await expect(
      t.run((context) =>
        context.db.query("deployActionConsumptions").collect(),
      ),
    ).resolves.toHaveLength(0);

    process.env.PROMOTION_AUTHORITY_MODE = "authority";
    process.env.PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL =
      unrelatedSigning.privateKeyPkcs8;
    await expect(
      t.withIdentity(operatorIdentity).query(readinessRef, {}),
    ).resolves.toMatchObject({
      kind: "ok",
      readiness: { ready: false, signingKeyConfigured: false },
    });
  });

  it("exports every audit event when a page boundary shares one timestamp", async () => {
    const t = convexTest(convexSchema, modules);
    await t.run(async (context) => {
      for (const suffix of ["a", "b", "c"]) {
        await context.db.insert("deployAuthorityAuditEvents", {
          eventId: `sha256:${suffix.repeat(64)}`,
          operation: "issuer-provisioned",
          actorHash,
          authorityOrigin,
          subjectKind: "issuer",
          subjectId: `issuer-${suffix}`,
          subjectFingerprint: `sha256:${suffix.repeat(64)}`,
          provenanceHash,
          occurredAt: now,
        });
      }
    });
    const actor = t.withIdentity(operatorIdentity);
    const first = await actor.query(auditExportRef, {
      limit: 2,
      cursor: null,
    });
    if (first.kind !== "ok") throw new Error("first audit page blocked");
    const second = await actor.query(auditExportRef, {
      limit: 2,
      cursor: first.audit.nextCursor,
    });
    if (second.kind !== "ok") throw new Error("second audit page blocked");
    expect(
      [...first.audit.events, ...second.audit.events].map(
        (event) => event.eventId,
      ),
    ).toHaveLength(3);
  });

  it("rejects the issuer transition that would cross the bounded ceiling", async () => {
    process.env.PROMOTION_AUTHORITY_MODE = "authority";
    const t = convexTest(convexSchema, modules);
    const active = keys();
    await t.run(async (context) => {
      for (let index = 0; index < 100; index += 1) {
        await context.db.insert("deployAuthorityIssuers", {
          issuerId: "maestro-promotion-authority-v1",
          publicKeyHash:
            index === 99
              ? active.publicKeyHash
              : `sha256:${index.toString(16).padStart(64, "0")}`,
          publicKeySpki:
            index === 99 ? active.publicKeySpki : `legacy-${index}`,
          enabled: index === 99,
          transition: index === 0 ? "activate" : "rotate",
          previousPublicKeyHash: null,
          authorityOrigin,
          activatedAt: now - 100 + index,
          retiredAt: null,
          provisionedAt: now - 100 + index,
          provisionedByHash: actorHash,
          provenanceHash,
        });
      }
    });
    const next = keys();
    await expect(
      t.withIdentity(operatorIdentity).mutation(rotateIssuerRef, {
        issuerId: "maestro-promotion-authority-v1",
        publicKeyHash: next.publicKeyHash,
        publicKeySpki: next.publicKeySpki,
        sourceReceiptHash: "sha256:" + "9".repeat(64),
      }),
    ).resolves.toEqual({ kind: "blocked", code: "issuer-unavailable" });
    await expect(
      t.run((context) => context.db.query("deployAuthorityIssuers").collect()),
    ).resolves.toHaveLength(100);
  });

  it("keeps typed authority env and the approved decision aligned with reality", () => {
    const root = resolve(import.meta.dirname, "../../..");
    const config = readFileSync(
      resolve(root, "packages/convex/convex/convex.config.ts"),
      "utf8",
    );
    const authorityEnv = readFileSync(
      resolve(root, "packages/convex/confect/deployAuthority/env.ts"),
      "utf8",
    );
    const decision = readFileSync(
      resolve(root, "docs/template/system-decisions/deployment-authority.md"),
      "utf8",
    );
    for (const name of [
      "PROMOTION_AUTHORITY_MODE",
      "PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL",
    ]) {
      expect(config).toContain(name);
      expect(authorityEnv).toContain(name);
      expect(authorityEnv).not.toContain(`process.env.${name}`);
    }
    expect(authorityEnv).toContain(
      'import { env as convexEnv } from "../../convex/_generated/server";',
    );
    expect(decision).toContain("six tables");
    expect(decision).toContain("provisioning authorities are");
    expect(decision).toContain("implemented behind explicit authority mode");
    expect(decision).toContain("Status: real");
  });

  it("rejects unauthenticated and non-operator provisioning without writes", async () => {
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    const args = {
      issuerId: "maestro-promotion-authority-v1",
      publicKeyHash: signing.publicKeyHash,
      publicKeySpki: signing.publicKeySpki,
      sourceReceiptHash: "sha256:" + "9".repeat(64),
    };

    await expect(t.mutation(provisionIssuerRef, args)).resolves.toEqual({
      kind: "blocked",
      code: "operator-unauthorized",
    });
    await expect(
      t
        .withIdentity({
          subject: "ordinary-user",
          issuer: "https://api.workos.com",
          tokenIdentifier: "https://api.workos.com|ordinary-user",
        })
        .mutation(provisionIssuerRef, args),
    ).resolves.toEqual({
      kind: "blocked",
      code: "operator-forbidden",
    });

    const issuerCount = await t.run(async (context) =>
      context.db
        .query("deployAuthorityIssuers")
        .collect()
        .then((rows) => rows.length),
    );
    expect(issuerCount).toBe(0);
  });

  it("requires explicit authority mode for authenticated provisioning", async () => {
    delete process.env.PROMOTION_AUTHORITY_MODE;
    const t = convexTest(convexSchema, modules);
    const signing = keys();

    await expect(
      t.withIdentity(operatorIdentity).mutation(provisionIssuerRef, {
        issuerId: "maestro-promotion-authority-v1",
        publicKeyHash: signing.publicKeyHash,
        publicKeySpki: signing.publicKeySpki,
        sourceReceiptHash: "sha256:" + "9".repeat(64),
      }),
    ).resolves.toEqual({ kind: "blocked", code: "authority-mode-missing" });
  });

  it("rotates one active issuer, blocks mixed-origin rotation, and exports hashed audit", async () => {
    process.env.PROMOTION_AUTHORITY_MODE = "authority";
    const t = convexTest(convexSchema, modules);
    const first = keys();
    const second = keys();
    const third = keys();
    const actor = t.withIdentity(operatorIdentity);
    const sourceReceiptHash = "sha256:" + "9".repeat(64);

    await expect(
      actor.mutation(provisionIssuerRef, {
        issuerId: "maestro-promotion-authority-v1",
        publicKeyHash: first.publicKeyHash,
        publicKeySpki: first.publicKeySpki,
        sourceReceiptHash,
      }),
    ).resolves.toEqual({ kind: "ok", resourceHash: first.publicKeyHash });
    await expect(
      actor.mutation(rotateIssuerRef, {
        issuerId: "maestro-promotion-authority-v1",
        publicKeyHash: second.publicKeyHash,
        publicKeySpki: second.publicKeySpki,
        sourceReceiptHash,
      }),
    ).resolves.toEqual({ kind: "ok", resourceHash: second.publicKeyHash });
    await expect(
      t
        .withIdentity({
          ...operatorIdentity,
          issuer: "https://other-authority.example",
          tokenIdentifier: "https://other-authority.example|release-operator",
        })
        .mutation(rotateIssuerRef, {
          issuerId: "maestro-promotion-authority-v1",
          publicKeyHash: third.publicKeyHash,
          publicKeySpki: third.publicKeySpki,
          sourceReceiptHash,
        }),
    ).resolves.toEqual({ kind: "blocked", code: "mixed-origin" });

    const status = await actor.query(statusRef, {});
    expect(status).toMatchObject({
      kind: "ok",
      status: {
        bounded: true,
        totalIssuerCount: 2,
        activeIssuerCount: 1,
        malformedIssuerCount: 0,
        mixedOrigin: false,
      },
    });
    const readiness = await actor.query(readinessRef, {});
    expect(readiness).toMatchObject({
      kind: "ok",
      readiness: {
        ready: false,
        authorityModeConfigured: true,
        signingKeyConfigured: false,
        activeIssuerCount: 1,
        issuerSetValid: true,
      },
    });
    const audit = await actor.query(auditExportRef, {
      limit: 10,
      cursor: null,
    });
    expect(audit).toMatchObject({ kind: "ok" });
    if (audit.kind !== "ok") throw new Error("authority audit was blocked");
    expect(
      audit.audit.events.map(
        (event: { readonly operation: string }) => event.operation,
      ),
    ).toEqual(expect.arrayContaining(["issuer-rotated", "issuer-provisioned"]));
    expect(JSON.stringify(audit)).not.toContain("release-operator");
  });

  it("provisions a signed issuer, approval, census, and verdict through the operator boundary", async () => {
    process.env.PROMOTION_AUTHORITY_MODE = "authority";
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    const clock = Date.now();
    const inputs = await makeProvisioningInputs(signing, clock);
    const actor = t.withIdentity(operatorIdentity);

    await expect(
      actor.mutation(provisionIssuerRef, inputs.issuer),
    ).resolves.toEqual({
      kind: "ok",
      resourceHash: inputs.issuer.publicKeyHash,
    });
    await expect(
      actor.mutation(provisionApprovalRef, inputs.approval),
    ).resolves.toEqual({
      kind: "ok",
      resourceHash: inputs.approval.approvalHash,
    });
    await expect(
      actor.mutation(provisionCensusRef, inputs.census),
    ).resolves.toEqual({
      kind: "ok",
      resourceHash: inputs.census.snapshotId,
    });
    await expect(
      actor.mutation(provisionVerdictRef, inputs.verdict),
    ).resolves.toEqual({
      kind: "ok",
      resourceHash: inputs.verdict.verdictHash,
    });
    await expect(
      actor.mutation(provisionApprovalRef, inputs.approval),
    ).resolves.toEqual({ kind: "blocked", code: "duplicate-record" });

    await expect(
      t.run((context) =>
        consumeDeployAuthority(
          context,
          scope,
          storeDependencies(signing, Date.now()),
        ),
      ),
    ).resolves.toMatchObject({
      kind: "authorized",
      payload: {
        approvalHash: inputs.approval.approvalHash,
        verdictHash: inputs.verdict.verdictHash,
      },
    });
    const audit = await actor.query(auditExportRef, {
      limit: 10,
      cursor: null,
    });
    expect(audit).toMatchObject({
      kind: "ok",
      audit: { events: expect.any(Array) },
    });
    if (audit.kind !== "ok") throw new Error("audit export was blocked");
    expect(
      audit.audit.events
        .map((event: { readonly operation: string }) => event.operation)
        .sort(),
    ).toEqual([
      "approval-provisioned",
      "census-provisioned",
      "issuer-provisioned",
      "verdict-provisioned",
    ]);
  });

  it("revokes by appending a retirement transition and leaves no active issuer", async () => {
    process.env.PROMOTION_AUTHORITY_MODE = "authority";
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    const actor = t.withIdentity(operatorIdentity);
    const sourceReceiptHash = "sha256:" + "9".repeat(64);
    await actor.mutation(provisionIssuerRef, {
      issuerId: "maestro-promotion-authority-v1",
      publicKeyHash: signing.publicKeyHash,
      publicKeySpki: signing.publicKeySpki,
      sourceReceiptHash,
    });
    await expect(
      actor.mutation(revokeIssuerRef, {
        issuerId: "maestro-promotion-authority-v1",
        sourceReceiptHash,
      }),
    ).resolves.toEqual({
      kind: "ok",
      resourceHash: signing.publicKeyHash,
    });
    const status = await actor.query(statusRef, {});
    expect(status).toMatchObject({
      kind: "ok",
      status: { totalIssuerCount: 2, activeIssuerCount: 0 },
    });
    const transitions = await t.run((context) =>
      context.db.query("deployAuthorityIssuers").take(3),
    );
    expect(transitions.map((row) => row.transition)).toEqual([
      "activate",
      "retire",
    ]);
  });

  it("rejects absent authority mode before store reads or receipt signing", async () => {
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    await t.run((context) => seedAuthority(context, signing));
    await expect(
      t.run((context) =>
        consumeDeployAuthority(context, scope, {
          ...storeDependencies(signing),
          authorityMode: undefined,
        }),
      ),
    ).resolves.toEqual({ kind: "denied" });

    const response = await handleDeployAuthorityHttpRequest(
      {
        runQuery: () => {
          throw new Error("mode guard must run before query");
        },
        runMutation: () => {
          throw new Error("mode guard must run before mutation");
        },
      },
      new Request("https://example.invalid/deploy-authority/consume", {
        method: "POST",
        body: JSON.stringify(scope),
      }),
      {
        privateKeyPkcs8Base64Url: signing.privateKeyPkcs8,
        authorityMode: undefined,
      },
    );
    expect(response.status).toBe(503);
  });

  it("allows a fresh approval to reauthorize the same rollback action without deleting history", async () => {
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    const first = await t.run((context) => seedAuthority(context, signing));
    await expect(
      t.run((context) =>
        consumeDeployAuthority(context, scope, storeDependencies(signing)),
      ),
    ).resolves.toMatchObject({ kind: "authorized" });

    const later = now + 120_001;
    const second = await t.run((context) =>
      seedAuthority(context, signing, undefined, {
        clock: later,
        generation: 2,
        includeIssuer: false,
      }),
    );
    await expect(
      t.run((context) =>
        consumeDeployAuthority(
          context,
          scope,
          storeDependencies(signing, later),
        ),
      ),
    ).resolves.toMatchObject({
      kind: "authorized",
      payload: { approvalHash: second.approvalHash },
    });
    expect(second.approvalHash).not.toBe(first.approvalHash);
    const consumptions = await t.run((context) =>
      context.db.query("deployActionConsumptions").take(3),
    );
    expect(consumptions.map((row) => row.approvalHash).sort()).toEqual(
      [first.approvalHash, second.approvalHash].sort(),
    );
  });

  it("fails closed on duplicate active approvals and mixed-origin census records", async () => {
    const duplicateTest = convexTest(convexSchema, modules);
    const duplicateSigning = keys();
    await duplicateTest.run((context) =>
      seedAuthority(context, duplicateSigning),
    );
    await duplicateTest.run(async (context) => {
      const row = (await context.db.query("deployApprovals").take(1))[0];
      if (row === undefined) throw new Error("missing seeded approval");
      const { _id, _creationTime, ...value } = row;
      void _id;
      void _creationTime;
      await context.db.insert("deployApprovals", value);
    });
    await expect(
      duplicateTest.run((context) =>
        consumeDeployAuthority(
          context,
          scope,
          storeDependencies(duplicateSigning),
        ),
      ),
    ).resolves.toEqual({ kind: "denied" });

    const originTest = convexTest(convexSchema, modules);
    const originSigning = keys();
    await originTest.run((context) => seedAuthority(context, originSigning));
    await originTest.run(async (context) => {
      const snapshot = (
        await context.db.query("deployCensusSnapshots").take(1)
      )[0];
      if (snapshot === undefined) throw new Error("missing seeded census");
      await context.db.patch("deployCensusSnapshots", snapshot._id, {
        authorityOrigin: "https://mixed-origin.example",
      });
    });
    await expect(
      originTest.run((context) =>
        consumeDeployAuthority(
          context,
          scope,
          storeDependencies(originSigning),
        ),
      ),
    ).resolves.toEqual({ kind: "denied" });
  });

  it("atomically consumes one exact action once under concurrency", async () => {
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    await t.run((context) => seedAuthority(context, signing));
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        t.run((context) =>
          consumeDeployAuthority(context, scope, storeDependencies(signing)),
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
        consumeDeployAuthority(context, scope, storeDependencies(signing)),
      ),
    ).resolves.toEqual({ kind: "denied" });
  });

  it("serves a signed receipt from the mounted route handler", async () => {
    const t = convexTest(convexSchema, modules);
    const signing = keys();
    await t.run((context) => seedAuthority(context, signing));
    let mutationError: unknown;
    const response = await handleDeployAuthorityHttpRequest(
      {
        runQuery: async () => ({
          publicKeyHash: signing.publicKeyHash,
          publicKeySpki: signing.publicKeySpki,
          authorityOrigin,
        }),
        runMutation: async (_reference, requestedScope) => {
          const {
            expectedIssuerPublicKeyHash,
            runtimeSigningKeyProofSignature,
            ...publicScope
          } = requestedScope;
          try {
            return await t.run((context) =>
              consumeDeployAuthority(context, publicScope, {
                nowMs: () => now,
                authorityMode: "authority",
                expectedIssuerPublicKeyHash,
                runtimeSigningKeyProofSignature,
              }),
            );
          } catch (error) {
            mutationError = error;
            throw error;
          }
        },
      },
      new Request("https://example.invalid/deploy-authority/consume", {
        method: "POST",
        body: JSON.stringify(scope),
      }),
      privateSigningMaterial(signing.privateKeyPkcs8),
    );
    expect(mutationError).toBeUndefined();
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
