import { DataModel } from "@confect/server";
import type { GenericMutationCtx } from "convex/server";
import databaseSchema from "../_generated/schema";

export type DeployAuthorityAction = "preflight" | "convex" | "cloudflare";
export const DEPLOY_AUTHORITY_ISSUER_ID =
  "maestro-promotion-authority-v1" as const;
export type DeployAuthorityScope = {
  readonly environment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly action: DeployAuthorityAction;
};
export type DeployAuthorityPayload = DeployAuthorityScope & {
  readonly schemaVersion: 1;
  readonly kind: "durable-deploy-authorization";
  readonly issuerId: string;
  readonly verdictHash: string;
  readonly approvalHash: string;
  readonly censusFingerprint: string;
  readonly consumptionId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
};

export type AuthorityContext = GenericMutationCtx<
  DataModel.ToConvex<DataModel.FromSchema<typeof databaseSchema>>
>;
type StoreDependencies = {
  readonly nowMs: () => number;
  readonly authorityMode: "authority" | undefined;
  readonly expectedIssuerPublicKeyHash: string;
  readonly runtimeSigningKeyProofSignature: string;
};

export const runtimeSigningKeyProofPayload = {
  schemaVersion: 1,
  kind: "deploy-authority-runtime-signing-key-proof",
  issuerId: DEPLOY_AUTHORITY_ISSUER_ID,
} as const;

export const consumeDeployAuthority = async (
  context: AuthorityContext,
  scope: DeployAuthorityScope,
  dependencies: StoreDependencies,
): Promise<
  | { readonly kind: "authorized"; readonly payload: DeployAuthorityPayload }
  | { readonly kind: "denied" | "replayed" }
> => {
  if (dependencies.authorityMode !== "authority") return { kind: "denied" };
  const now = dependencies.nowMs();
  const approvals = await context.db
    .query("deployApprovals")
    .withIndex("by_scope_and_expires_at", (query) =>
      query
        .eq("environment", scope.environment)
        .eq("targetId", scope.targetId)
        .eq("commitSha", scope.commitSha)
        .gt("expiresAt", now),
    )
    .take(2);
  if (approvals.length !== 1) return { kind: "denied" };
  const approval = approvals[0];
  if (approval === undefined) return { kind: "denied" };

  const [verdicts, consumptions] = await Promise.all([
    context.db
      .query("deployVerdicts")
      .withIndex("by_scope_approval_and_expires_at", (query) =>
        query
          .eq("environment", scope.environment)
          .eq("targetId", scope.targetId)
          .eq("commitSha", scope.commitSha)
          .eq("approvalHash", approval.approvalHash)
          .gt("expiresAt", now),
      )
      .take(2),
    context.db
      .query("deployActionConsumptions")
      .withIndex("by_scope_action_approval", (query) =>
        query
          .eq("environment", scope.environment)
          .eq("targetId", scope.targetId)
          .eq("commitSha", scope.commitSha)
          .eq("action", scope.action)
          .eq("approvalHash", approval.approvalHash),
      )
      .take(2),
  ]);
  if (consumptions.length > 0) return { kind: "replayed" };
  if (verdicts.length !== 1) return { kind: "denied" };
  const verdict = verdicts[0];
  if (verdict === undefined) return { kind: "denied" };
  if (
    approval.expiresAt <= now ||
    verdict.expiresAt <= now ||
    approval.issuedAt === undefined ||
    approval.issuedAt > now ||
    verdict.issuedAt === undefined ||
    verdict.issuedAt > now ||
    approval.issuerId !== verdict.issuerId ||
    approval.issuerId !== DEPLOY_AUTHORITY_ISSUER_ID ||
    approval.approvalHash !== verdict.approvalHash ||
    approval.issuerPublicKeyHash === undefined ||
    approval.issuerPublicKeyHash !== verdict.issuerPublicKeyHash ||
    approval.authorityOrigin === undefined ||
    approval.authorityOrigin !== verdict.authorityOrigin
  )
    return { kind: "denied" };

  const issuerRows = await context.db
    .query("deployAuthorityIssuers")
    .withIndex("by_issuer", (query) => query.eq("issuerId", approval.issuerId))
    .take(101);
  if (issuerRows.length > 100) return { kind: "denied" };
  const latestProvisionedAt = Math.max(
    -1,
    ...issuerRows.map((row) => row.provisionedAt ?? -1),
  );
  const currentIssuers = issuerRows.filter(
    (row) => row.provisionedAt === latestProvisionedAt,
  );
  const activeIssuers = currentIssuers.filter(
    (row) =>
      row.enabled &&
      row.retiredAt === null &&
      row.activatedAt !== undefined &&
      row.activatedAt <= now,
  );
  if (activeIssuers.length !== 1) return { kind: "denied" };
  const issuer = activeIssuers[0];
  if (
    issuer === undefined ||
    issuer.authorityOrigin === undefined ||
    issuer.authorityOrigin !== approval.authorityOrigin ||
    issuer.publicKeyHash !== approval.issuerPublicKeyHash ||
    issuer.publicKeyHash !== dependencies.expectedIssuerPublicKeyHash ||
    issuer.publicKeyHash !== (await sha256(issuer.publicKeySpki)) ||
    !(await verifyIssuerSignature(
      issuer.publicKeySpki,
      canonical(runtimeSigningKeyProofPayload),
      dependencies.runtimeSigningKeyProofSignature,
    ))
  )
    return { kind: "denied" };

  const approvalPayload = {
    schemaVersion: 1,
    kind: "deploy-approval",
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId: approval.issuerId,
    issuerPublicKeyHash: approval.issuerPublicKeyHash,
    authorityOrigin: approval.authorityOrigin,
    issuedAt: approval.issuedAt,
    expiresAt: approval.expiresAt,
  } as const;
  if (
    approval.approvalHash !== (await sha256(canonical(approvalPayload))) ||
    !(await verifyIssuerSignature(
      issuer.publicKeySpki,
      canonical({ ...approvalPayload, approvalHash: approval.approvalHash }),
      approval.signature,
    ))
  )
    return { kind: "denied" };

  const snapshots = await context.db
    .query("deployCensusSnapshots")
    .withIndex("by_snapshot", (query) =>
      query.eq("snapshotId", verdict.censusSnapshotId),
    )
    .take(2);
  if (snapshots.length !== 1) return { kind: "denied" };
  const snapshot = snapshots[0];
  if (
    snapshot === undefined ||
    snapshot.environment !== scope.environment ||
    snapshot.targetId !== scope.targetId ||
    snapshot.commitSha !== scope.commitSha ||
    snapshot.authorityOrigin === undefined ||
    snapshot.authorityOrigin !== approval.authorityOrigin ||
    snapshot.expiresAt <= now ||
    snapshot.capturedAt > now
  )
    return { kind: "denied" };
  const censusFingerprint = await validateAndHashSnapshot(snapshot);
  if (
    censusFingerprint === undefined ||
    censusFingerprint !== snapshot.snapshotId
  )
    return { kind: "denied" };

  const verdictPayload = {
    schemaVersion: 1,
    kind: "deploy-verdict",
    environment: scope.environment,
    targetId: scope.targetId,
    commitSha: scope.commitSha,
    issuerId: verdict.issuerId,
    issuerPublicKeyHash: verdict.issuerPublicKeyHash,
    authorityOrigin: verdict.authorityOrigin,
    approvalHash: verdict.approvalHash,
    censusFingerprint,
    issuedAt: verdict.issuedAt,
    expiresAt: verdict.expiresAt,
  } as const;
  if (
    verdict.verdictHash !== (await sha256(canonical(verdictPayload))) ||
    !(await verifyIssuerSignature(
      issuer.publicKeySpki,
      canonical({ ...verdictPayload, verdictHash: verdict.verdictHash }),
      verdict.signature,
    ))
  )
    return { kind: "denied" };

  const consumptionId = (
    await sha256(
      canonical({
        ...scope,
        approvalHash: approval.approvalHash,
        consumedAt: now,
      }),
    )
  ).slice("sha256:".length);
  await context.db.insert("deployActionConsumptions", {
    ...scope,
    approvalHash: approval.approvalHash,
    verdictHash: verdict.verdictHash,
    authorityOrigin: approval.authorityOrigin,
    consumptionId,
    consumedAt: now,
  });
  return {
    kind: "authorized",
    payload: {
      schemaVersion: 1,
      kind: "durable-deploy-authorization",
      ...scope,
      issuerId: issuer.issuerId,
      verdictHash: verdict.verdictHash,
      approvalHash: approval.approvalHash,
      censusFingerprint,
      consumptionId,
      issuedAt: now,
      expiresAt: Math.min(
        now + 60_000,
        approval.expiresAt,
        verdict.expiresAt,
        snapshot.expiresAt,
      ),
    },
  };
};

export const validateAndHashSnapshot = async (
  snapshot: Record<string, unknown>,
): Promise<string | undefined> => {
  let runs: unknown;
  let immutableBindings: unknown;
  try {
    runs = JSON.parse(String(snapshot.runsJson));
    immutableBindings = JSON.parse(String(snapshot.immutableBindingsJson));
  } catch {
    return undefined;
  }
  if (
    !Array.isArray(runs) ||
    !Array.isArray(immutableBindings) ||
    snapshot.nextCursor !== null ||
    !Number.isSafeInteger(snapshot.pageCount) ||
    Number(snapshot.pageCount) < 1 ||
    !Number.isSafeInteger(snapshot.totalCount) ||
    Number(snapshot.totalCount) !== runs.length ||
    immutableBindings.length !== runs.length
  )
    return undefined;
  const bindings = new Map(
    immutableBindings.map((binding) => {
      if (!isRecord(binding)) return ["", binding] as const;
      return [
        `${binding.workflowId}@${binding.workflowVersion}`,
        binding,
      ] as const;
    }),
  );
  if (bindings.size !== runs.length || bindings.has("")) return undefined;
  let previous = "";
  for (const run of runs) {
    if (!isRecord(run)) return undefined;
    const { runFingerprint, ...runPayload } = run;
    if (
      typeof runFingerprint !== "string" ||
      runFingerprint !== (await sha256(canonical(runPayload))) ||
      (previous !== "" && previous >= runFingerprint)
    )
      return undefined;
    previous = runFingerprint;
    const binding = bindings.get(`${run.workflowId}@${run.workflowVersion}`);
    if (
      !isRecord(binding) ||
      [
        "runnerHash",
        "runtimeHash",
        "capabilityBindingsHash",
        "completionBindingHash",
      ].some((field) => run[field] !== binding[field])
    )
      return undefined;
  }
  return sha256(
    canonical({
      pageCount: snapshot.pageCount,
      totalCount: snapshot.totalCount,
      nextCursor: null,
      runs,
      immutableBindings,
    }),
  );
};

export const verifyIssuerSignature = async (
  publicKeySpki: string,
  message: string,
  signature: string,
): Promise<boolean> => {
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      decodeBase64Url(publicKeySpki),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(message),
    );
  } catch {
    return false;
  }
};

export const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
};
export const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
};
const decodeBase64Url = (value: string): ArrayBuffer => {
  const bytes = Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (char) => char.charCodeAt(0),
  );
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
