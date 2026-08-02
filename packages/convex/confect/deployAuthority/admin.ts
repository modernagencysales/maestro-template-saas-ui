import { DataModel } from "@confect/server";
import type { GenericQueryCtx } from "convex/server";
import databaseSchema from "../_generated/schema";
import {
  canonical,
  DEPLOY_AUTHORITY_ISSUER_ID,
  sha256,
  type AuthorityContext,
  validateAndHashSnapshot,
  verifyIssuerSignature,
} from "./store";

export type DeployAuthorityOperator = {
  readonly actorHash: string;
  readonly authorityOrigin: string;
};

export type AuthorityAdminCode =
  | "operator-unauthorized"
  | "operator-forbidden"
  | "authority-mode-missing"
  | "invalid-input"
  | "duplicate-record"
  | "scope-conflict"
  | "issuer-unavailable"
  | "signature-invalid"
  | "mixed-origin"
  | "not-found";

export type AuthorityAdminResult =
  | { readonly kind: "ok"; readonly resourceHash: string }
  | { readonly kind: "blocked"; readonly code: AuthorityAdminCode };

export type AuthorityReadContext = GenericQueryCtx<
  DataModel.ToConvex<DataModel.FromSchema<typeof databaseSchema>>
>;

export type IssuerInput = {
  readonly issuerId: string;
  readonly publicKeyHash: string;
  readonly publicKeySpki: string;
  readonly sourceReceiptHash: string;
};

export type ApprovalInput = {
  readonly environment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly issuerId: string;
  readonly issuerPublicKeyHash: string;
  readonly approvalHash: string;
  readonly signature: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly sourceReceiptHash: string;
};

export type CensusInput = {
  readonly snapshotId: string;
  readonly environment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly capturedAt: number;
  readonly expiresAt: number;
  readonly pageCount: number;
  readonly totalCount: number;
  readonly nextCursor: string | null;
  readonly runsJson: string;
  readonly immutableBindingsJson: string;
  readonly sourceReceiptHash: string;
};

export type VerdictInput = {
  readonly environment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly issuerId: string;
  readonly issuerPublicKeyHash: string;
  readonly approvalHash: string;
  readonly verdictHash: string;
  readonly censusSnapshotId: string;
  readonly signature: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly sourceReceiptHash: string;
};

const shaPattern = /^sha256:[0-9a-f]{64}$/;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
const targetPattern = /^[a-z][a-z0-9-]{0,62}$/;
const commitPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const MAX_EVIDENCE_TTL_MS = 10 * 60_000;
const MAX_ISSUER_ROWS = 100;

export const authenticateDeployAuthorityOperator = async (
  identity: unknown,
): Promise<
  | { readonly kind: "ok"; readonly operator: DeployAuthorityOperator }
  | {
      readonly kind: "blocked";
      readonly code: "operator-unauthorized" | "operator-forbidden";
    }
> => {
  if (!isRecord(identity)) {
    return { kind: "blocked", code: "operator-unauthorized" };
  }
  if (identity.deploymentAuthorityOperator !== true) {
    return { kind: "blocked", code: "operator-forbidden" };
  }
  if (
    typeof identity.tokenIdentifier !== "string" ||
    identity.tokenIdentifier.length < 3 ||
    identity.tokenIdentifier.length > 512 ||
    typeof identity.issuer !== "string"
  ) {
    return { kind: "blocked", code: "operator-forbidden" };
  }
  const authorityOrigin = exactHttpsOrigin(identity.issuer);
  if (authorityOrigin === undefined) {
    return { kind: "blocked", code: "operator-forbidden" };
  }
  return {
    kind: "ok",
    operator: {
      actorHash: await sha256(identity.tokenIdentifier),
      authorityOrigin,
    },
  };
};

export const provisionIssuer = async (
  context: AuthorityContext,
  operator: DeployAuthorityOperator,
  input: IssuerInput,
  now: number,
): Promise<AuthorityAdminResult> => {
  if (!(await validIssuerInput(input)) || !validTime(now)) {
    return blocked("invalid-input");
  }
  const [sameIssuer, sameKey] = await Promise.all([
    context.db
      .query("deployAuthorityIssuers")
      .withIndex("by_issuer", (query) => query.eq("issuerId", input.issuerId))
      .take(2),
    context.db
      .query("deployAuthorityIssuers")
      .withIndex("by_public_key_hash", (query) =>
        query.eq("publicKeyHash", input.publicKeyHash),
      )
      .take(2),
  ]);
  if (sameIssuer.length > 0 || sameKey.length > 0) {
    return blocked("duplicate-record");
  }
  const provenanceHash = await authorityProvenanceHash({
    operation: "issuer-provisioned",
    operator,
    sourceReceiptHash: input.sourceReceiptHash,
    subjectFingerprint: input.publicKeyHash,
    occurredAt: now,
  });
  await context.db.insert("deployAuthorityIssuers", {
    issuerId: input.issuerId,
    publicKeyHash: input.publicKeyHash,
    publicKeySpki: input.publicKeySpki,
    enabled: true,
    transition: "activate",
    previousPublicKeyHash: null,
    authorityOrigin: operator.authorityOrigin,
    activatedAt: now,
    retiredAt: null,
    provisionedAt: now,
    provisionedByHash: operator.actorHash,
    provenanceHash,
  });
  await appendAudit(context, operator, {
    operation: "issuer-provisioned",
    subjectKind: "issuer",
    subjectId: input.issuerId,
    subjectFingerprint: input.publicKeyHash,
    provenanceHash,
    occurredAt: now,
  });
  return ok(input.publicKeyHash);
};

export const rotateIssuer = async (
  context: AuthorityContext,
  operator: DeployAuthorityOperator,
  input: IssuerInput,
  now: number,
): Promise<AuthorityAdminResult> => {
  if (!(await validIssuerInput(input)) || !validTime(now)) {
    return blocked("invalid-input");
  }
  const rows = await issuerRows(context, input.issuerId);
  const active = activeIssuerRows(rows, now);
  if (rows.length >= MAX_ISSUER_ROWS || active.length !== 1) {
    return blocked("issuer-unavailable");
  }
  const previous = active[0];
  if (previous === undefined) return blocked("issuer-unavailable");
  if (previous.authorityOrigin !== operator.authorityOrigin) {
    return blocked("mixed-origin");
  }
  const sameKey = await context.db
    .query("deployAuthorityIssuers")
    .withIndex("by_public_key_hash", (query) =>
      query.eq("publicKeyHash", input.publicKeyHash),
    )
    .take(2);
  if (sameKey.length > 0) return blocked("duplicate-record");

  const provenanceHash = await authorityProvenanceHash({
    operation: "issuer-rotated",
    operator,
    sourceReceiptHash: input.sourceReceiptHash,
    subjectFingerprint: input.publicKeyHash,
    occurredAt: now,
  });
  await context.db.insert("deployAuthorityIssuers", {
    issuerId: input.issuerId,
    publicKeyHash: input.publicKeyHash,
    publicKeySpki: input.publicKeySpki,
    enabled: true,
    transition: "rotate",
    previousPublicKeyHash: previous.publicKeyHash,
    authorityOrigin: operator.authorityOrigin,
    activatedAt: now,
    retiredAt: null,
    provisionedAt: now,
    provisionedByHash: operator.actorHash,
    provenanceHash,
  });
  await appendAudit(context, operator, {
    operation: "issuer-rotated",
    subjectKind: "issuer",
    subjectId: input.issuerId,
    subjectFingerprint: input.publicKeyHash,
    provenanceHash,
    occurredAt: now,
  });
  return ok(input.publicKeyHash);
};

export const retireIssuer = async (
  context: AuthorityContext,
  operator: DeployAuthorityOperator,
  input: { readonly issuerId: string; readonly sourceReceiptHash: string },
  now: number,
): Promise<AuthorityAdminResult> => {
  if (
    input.issuerId !== DEPLOY_AUTHORITY_ISSUER_ID ||
    !shaPattern.test(input.sourceReceiptHash) ||
    !validTime(now)
  ) {
    return blocked("invalid-input");
  }
  const rows = await issuerRows(context, input.issuerId);
  const active = activeIssuerRows(rows, now);
  if (rows.length >= MAX_ISSUER_ROWS || active.length !== 1) {
    return blocked("issuer-unavailable");
  }
  const issuer = active[0];
  if (issuer === undefined) return blocked("issuer-unavailable");
  if (issuer.activatedAt === undefined) return blocked("issuer-unavailable");
  if (issuer.authorityOrigin !== operator.authorityOrigin) {
    return blocked("mixed-origin");
  }
  const provenanceHash = await authorityProvenanceHash({
    operation: "issuer-retired",
    operator,
    sourceReceiptHash: input.sourceReceiptHash,
    subjectFingerprint: issuer.publicKeyHash,
    occurredAt: now,
  });
  await context.db.insert("deployAuthorityIssuers", {
    issuerId: issuer.issuerId,
    publicKeyHash: issuer.publicKeyHash,
    publicKeySpki: issuer.publicKeySpki,
    enabled: false,
    transition: "retire",
    previousPublicKeyHash: issuer.publicKeyHash,
    authorityOrigin: operator.authorityOrigin,
    activatedAt: issuer.activatedAt,
    retiredAt: now,
    provisionedAt: now,
    provisionedByHash: operator.actorHash,
    provenanceHash,
  });
  await appendAudit(context, operator, {
    operation: "issuer-retired",
    subjectKind: "issuer",
    subjectId: input.issuerId,
    subjectFingerprint: issuer.publicKeyHash,
    provenanceHash,
    occurredAt: now,
  });
  return ok(issuer.publicKeyHash);
};

export const provisionApproval = async (
  context: AuthorityContext,
  operator: DeployAuthorityOperator,
  input: ApprovalInput,
  now: number,
): Promise<AuthorityAdminResult> => {
  if (!validApprovalInput(input, now)) return blocked("invalid-input");
  const issuer = await requireActiveIssuer(context, input, operator, now);
  if (issuer.kind === "blocked") return issuer;
  const payload = approvalPayload(input, operator.authorityOrigin);
  if (
    input.approvalHash !== (await sha256(canonical(payload))) ||
    !(await verifyIssuerSignature(
      issuer.publicKeySpki,
      canonical({ ...payload, approvalHash: input.approvalHash }),
      input.signature,
    ))
  ) {
    return blocked("signature-invalid");
  }
  const [duplicates, liveScope] = await Promise.all([
    context.db
      .query("deployApprovals")
      .withIndex("by_approval_hash", (query) =>
        query.eq("approvalHash", input.approvalHash),
      )
      .take(2),
    context.db
      .query("deployApprovals")
      .withIndex("by_scope_and_expires_at", (query) =>
        query
          .eq("environment", input.environment)
          .eq("targetId", input.targetId)
          .eq("commitSha", input.commitSha)
          .gt("expiresAt", now),
      )
      .take(2),
  ]);
  if (duplicates.length > 0) return blocked("duplicate-record");
  if (liveScope.length > 0) return blocked("scope-conflict");
  const provenanceHash = await authorityProvenanceHash({
    operation: "approval-provisioned",
    operator,
    sourceReceiptHash: input.sourceReceiptHash,
    subjectFingerprint: input.approvalHash,
    occurredAt: now,
  });
  await context.db.insert("deployApprovals", {
    environment: input.environment,
    targetId: input.targetId,
    commitSha: input.commitSha,
    issuerId: input.issuerId,
    issuerPublicKeyHash: input.issuerPublicKeyHash,
    authorityOrigin: operator.authorityOrigin,
    approvalHash: input.approvalHash,
    signature: input.signature,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    provisionedAt: now,
    provisionedByHash: operator.actorHash,
    provenanceHash,
  });
  await appendAudit(context, operator, {
    operation: "approval-provisioned",
    subjectKind: "approval",
    subjectId: input.approvalHash,
    subjectFingerprint: input.approvalHash,
    provenanceHash,
    occurredAt: now,
  });
  return ok(input.approvalHash);
};

export const provisionCensus = async (
  context: AuthorityContext,
  operator: DeployAuthorityOperator,
  input: CensusInput,
  now: number,
): Promise<AuthorityAdminResult> => {
  if (!validCensusInput(input, now)) return blocked("invalid-input");
  const fingerprint = await validateAndHashSnapshot(input);
  if (fingerprint === undefined || fingerprint !== input.snapshotId) {
    return blocked("invalid-input");
  }
  const duplicates = await context.db
    .query("deployCensusSnapshots")
    .withIndex("by_snapshot", (query) =>
      query.eq("snapshotId", input.snapshotId),
    )
    .take(2);
  if (duplicates.length > 0) return blocked("duplicate-record");
  const provenanceHash = await authorityProvenanceHash({
    operation: "census-provisioned",
    operator,
    sourceReceiptHash: input.sourceReceiptHash,
    subjectFingerprint: input.snapshotId,
    occurredAt: now,
  });
  await context.db.insert("deployCensusSnapshots", {
    snapshotId: input.snapshotId,
    environment: input.environment,
    targetId: input.targetId,
    commitSha: input.commitSha,
    capturedAt: input.capturedAt,
    expiresAt: input.expiresAt,
    pageCount: input.pageCount,
    totalCount: input.totalCount,
    nextCursor: input.nextCursor,
    runsJson: input.runsJson,
    immutableBindingsJson: input.immutableBindingsJson,
    authorityOrigin: operator.authorityOrigin,
    provisionedAt: now,
    provisionedByHash: operator.actorHash,
    provenanceHash,
  });
  await appendAudit(context, operator, {
    operation: "census-provisioned",
    subjectKind: "census",
    subjectId: input.snapshotId,
    subjectFingerprint: input.snapshotId,
    provenanceHash,
    occurredAt: now,
  });
  return ok(input.snapshotId);
};

export const provisionVerdict = async (
  context: AuthorityContext,
  operator: DeployAuthorityOperator,
  input: VerdictInput,
  now: number,
): Promise<AuthorityAdminResult> => {
  if (!validVerdictInput(input, now)) return blocked("invalid-input");
  const issuer = await requireActiveIssuer(context, input, operator, now);
  if (issuer.kind === "blocked") return issuer;
  const [approvals, snapshots, duplicateVerdicts, liveVerdicts] =
    await Promise.all([
      context.db
        .query("deployApprovals")
        .withIndex("by_approval_hash", (query) =>
          query.eq("approvalHash", input.approvalHash),
        )
        .take(2),
      context.db
        .query("deployCensusSnapshots")
        .withIndex("by_snapshot", (query) =>
          query.eq("snapshotId", input.censusSnapshotId),
        )
        .take(2),
      context.db
        .query("deployVerdicts")
        .withIndex("by_verdict_hash", (query) =>
          query.eq("verdictHash", input.verdictHash),
        )
        .take(2),
      context.db
        .query("deployVerdicts")
        .withIndex("by_scope_approval_and_expires_at", (query) =>
          query
            .eq("environment", input.environment)
            .eq("targetId", input.targetId)
            .eq("commitSha", input.commitSha)
            .eq("approvalHash", input.approvalHash)
            .gt("expiresAt", now),
        )
        .take(2),
    ]);
  if (duplicateVerdicts.length > 0) return blocked("duplicate-record");
  if (liveVerdicts.length > 0) return blocked("scope-conflict");
  if (approvals.length !== 1 || snapshots.length !== 1) {
    return blocked("not-found");
  }
  const approval = approvals[0];
  const snapshot = snapshots[0];
  if (approval === undefined || snapshot === undefined) {
    return blocked("not-found");
  }
  if (
    approval.authorityOrigin !== operator.authorityOrigin ||
    snapshot.authorityOrigin !== operator.authorityOrigin ||
    approval.issuerPublicKeyHash !== input.issuerPublicKeyHash
  ) {
    return blocked("mixed-origin");
  }
  if (
    approval.environment !== input.environment ||
    approval.targetId !== input.targetId ||
    approval.commitSha !== input.commitSha ||
    approval.issuerId !== input.issuerId ||
    approval.expiresAt <= now ||
    snapshot.environment !== input.environment ||
    snapshot.targetId !== input.targetId ||
    snapshot.commitSha !== input.commitSha ||
    snapshot.expiresAt <= now
  ) {
    return blocked("scope-conflict");
  }
  const payload = verdictPayload(
    input,
    operator.authorityOrigin,
    input.censusSnapshotId,
  );
  if (
    input.verdictHash !== (await sha256(canonical(payload))) ||
    !(await verifyIssuerSignature(
      issuer.publicKeySpki,
      canonical({ ...payload, verdictHash: input.verdictHash }),
      input.signature,
    ))
  ) {
    return blocked("signature-invalid");
  }
  const provenanceHash = await authorityProvenanceHash({
    operation: "verdict-provisioned",
    operator,
    sourceReceiptHash: input.sourceReceiptHash,
    subjectFingerprint: input.verdictHash,
    occurredAt: now,
  });
  await context.db.insert("deployVerdicts", {
    environment: input.environment,
    targetId: input.targetId,
    commitSha: input.commitSha,
    issuerId: input.issuerId,
    issuerPublicKeyHash: input.issuerPublicKeyHash,
    authorityOrigin: operator.authorityOrigin,
    approvalHash: input.approvalHash,
    verdictHash: input.verdictHash,
    censusSnapshotId: input.censusSnapshotId,
    signature: input.signature,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    provisionedAt: now,
    provisionedByHash: operator.actorHash,
    provenanceHash,
  });
  await appendAudit(context, operator, {
    operation: "verdict-provisioned",
    subjectKind: "verdict",
    subjectId: input.verdictHash,
    subjectFingerprint: input.verdictHash,
    provenanceHash,
    occurredAt: now,
  });
  return ok(input.verdictHash);
};

export const readAuthorityStatus = async (
  context: AuthorityReadContext,
  operator: DeployAuthorityOperator,
  now: number,
) => {
  const rows = await context.db
    .query("deployAuthorityIssuers")
    .withIndex("by_issuer", (query) =>
      query.eq("issuerId", DEPLOY_AUTHORITY_ISSUER_ID),
    )
    .take(MAX_ISSUER_ROWS + 1);
  const bounded = rows.length <= MAX_ISSUER_ROWS;
  const inspected = rows.slice(0, MAX_ISSUER_ROWS);
  const active = activeIssuerRows(inspected, now);
  const origins = new Set(
    inspected.flatMap((row) =>
      typeof row.authorityOrigin === "string" ? [row.authorityOrigin] : [],
    ),
  );
  const malformedIssuerCount = inspected.filter(
    (row) =>
      row.activatedAt === undefined ||
      row.retiredAt === undefined ||
      row.provisionedAt === undefined ||
      row.provisionedByHash === undefined ||
      row.provenanceHash === undefined ||
      row.authorityOrigin === undefined,
  ).length;
  const auditRows = await context.db
    .query("deployAuthorityAuditEvents")
    .withIndex("by_actor_and_occurred_at", (query) =>
      query.eq("actorHash", operator.actorHash),
    )
    .order("desc")
    .take(1);
  return {
    bounded,
    totalIssuerCount: inspected.length,
    activeIssuerCount: active.length,
    malformedIssuerCount,
    mixedOrigin: origins.size > 1,
    authorityOrigin: operator.authorityOrigin,
    lastOperatorAuditAt: auditRows[0]?.occurredAt ?? null,
  } as const;
};

export const readAuthorityReadiness = async (
  context: AuthorityReadContext,
  operator: DeployAuthorityOperator,
  now: number,
  runtime: {
    readonly authorityMode: "authority" | undefined;
    readonly signingKeyValid: boolean;
  },
) => {
  const status = await readAuthorityStatus(context, operator, now);
  const ready =
    runtime.authorityMode === "authority" &&
    runtime.signingKeyValid &&
    status.bounded &&
    status.activeIssuerCount === 1 &&
    status.malformedIssuerCount === 0 &&
    !status.mixedOrigin;
  return {
    ready,
    authorityModeConfigured: runtime.authorityMode === "authority",
    signingKeyConfigured: runtime.signingKeyValid,
    activeIssuerCount: status.activeIssuerCount,
    issuerSetValid:
      status.bounded &&
      status.activeIssuerCount === 1 &&
      status.malformedIssuerCount === 0 &&
      !status.mixedOrigin,
  } as const;
};

export const exportAuthorityAudit = async (
  context: AuthorityReadContext,
  operator: DeployAuthorityOperator,
  input: {
    readonly limit: number;
    readonly cursor: {
      readonly occurredAt: number;
      readonly eventId: string;
    } | null;
  },
) => {
  const limit =
    Number.isSafeInteger(input.limit) && input.limit >= 1 && input.limit <= 100
      ? input.limit
      : 50;
  const cursor =
    input.cursor !== null &&
    validTime(input.cursor.occurredAt) &&
    shaPattern.test(input.cursor.eventId)
      ? input.cursor
      : null;
  const rows = cursor
    ? await readAuditRowsAfterCursor(context, cursor, limit + 1)
    : await context.db
        .query("deployAuthorityAuditEvents")
        .withIndex("by_occurred_at_and_event_id")
        .order("desc")
        .take(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    events: page.map((row) => ({
      eventId: row.eventId,
      operation: row.operation,
      actorHash: row.actorHash,
      authorityOrigin: row.authorityOrigin,
      subjectKind: row.subjectKind,
      subjectId: row.subjectId,
      subjectFingerprint: row.subjectFingerprint,
      provenanceHash: row.provenanceHash,
      occurredAt: row.occurredAt,
    })),
    nextCursor:
      rows.length > limit && last
        ? { occurredAt: last.occurredAt, eventId: last.eventId }
        : null,
    requestedByActorHash: operator.actorHash,
  } as const;
};

export const readRuntimeSigningIssuer = async (
  context: AuthorityReadContext,
  now: number,
) => {
  const rows = await context.db
    .query("deployAuthorityIssuers")
    .withIndex("by_issuer", (query) =>
      query.eq("issuerId", DEPLOY_AUTHORITY_ISSUER_ID),
    )
    .take(MAX_ISSUER_ROWS + 1);
  if (rows.length > MAX_ISSUER_ROWS) return null;
  const active = activeIssuerRows(rows, now);
  if (active.length !== 1) return null;
  const issuer = active[0];
  if (
    issuer === undefined ||
    typeof issuer.authorityOrigin !== "string" ||
    issuer.publicKeyHash !== (await sha256(issuer.publicKeySpki))
  )
    return null;
  return {
    publicKeyHash: issuer.publicKeyHash,
    publicKeySpki: issuer.publicKeySpki,
    authorityOrigin: issuer.authorityOrigin,
  } as const;
};

const readAuditRowsAfterCursor = async (
  context: AuthorityReadContext,
  cursor: { readonly occurredAt: number; readonly eventId: string },
  count: number,
) => {
  const sameTimestamp = await context.db
    .query("deployAuthorityAuditEvents")
    .withIndex("by_occurred_at_and_event_id", (range) =>
      range.eq("occurredAt", cursor.occurredAt).lt("eventId", cursor.eventId),
    )
    .order("desc")
    .take(count);
  if (sameTimestamp.length >= count) return sameTimestamp;
  const older = await context.db
    .query("deployAuthorityAuditEvents")
    .withIndex("by_occurred_at_and_event_id", (range) =>
      range.lt("occurredAt", cursor.occurredAt),
    )
    .order("desc")
    .take(count - sameTimestamp.length);
  return [...sameTimestamp, ...older];
};

export const approvalPayload = (
  input: ApprovalInput,
  authorityOrigin: string,
) =>
  ({
    schemaVersion: 1,
    kind: "deploy-approval",
    environment: input.environment,
    targetId: input.targetId,
    commitSha: input.commitSha,
    issuerId: input.issuerId,
    issuerPublicKeyHash: input.issuerPublicKeyHash,
    authorityOrigin,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  }) as const;

export const verdictPayload = (
  input: VerdictInput,
  authorityOrigin: string,
  censusFingerprint: string,
) =>
  ({
    schemaVersion: 1,
    kind: "deploy-verdict",
    environment: input.environment,
    targetId: input.targetId,
    commitSha: input.commitSha,
    issuerId: input.issuerId,
    issuerPublicKeyHash: input.issuerPublicKeyHash,
    authorityOrigin,
    approvalHash: input.approvalHash,
    censusFingerprint,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  }) as const;

const requireActiveIssuer = async (
  context: AuthorityContext,
  input: { readonly issuerId: string; readonly issuerPublicKeyHash: string },
  operator: DeployAuthorityOperator,
  now: number,
): Promise<
  | { readonly kind: "ok"; readonly publicKeySpki: string }
  | { readonly kind: "blocked"; readonly code: AuthorityAdminCode }
> => {
  const rows = await issuerRows(context, input.issuerId);
  const active = activeIssuerRows(rows, now);
  if (rows.length > MAX_ISSUER_ROWS || active.length !== 1) {
    return blocked("issuer-unavailable");
  }
  const issuer = active[0];
  if (issuer === undefined) return blocked("issuer-unavailable");
  if (
    issuer.authorityOrigin !== operator.authorityOrigin ||
    issuer.publicKeyHash !== input.issuerPublicKeyHash
  ) {
    return blocked("mixed-origin");
  }
  return { kind: "ok", publicKeySpki: issuer.publicKeySpki };
};

const issuerRows = (context: AuthorityContext, issuerId: string) =>
  context.db
    .query("deployAuthorityIssuers")
    .withIndex("by_issuer", (query) => query.eq("issuerId", issuerId))
    .take(MAX_ISSUER_ROWS + 1);

const activeIssuerRows = <
  Row extends {
    readonly enabled: boolean;
    readonly activatedAt?: number;
    readonly retiredAt?: number | null;
    readonly provisionedAt?: number;
    readonly _creationTime?: number;
  },
>(
  rows: readonly Row[],
  now: number,
): readonly Row[] => {
  const timestamp = Math.max(-1, ...rows.map((row) => row.provisionedAt ?? -1));
  const candidates = rows.filter((row) => row.provisionedAt === timestamp);
  const creationTime = Math.max(
    -1,
    ...candidates.map((row) => row._creationTime ?? -1),
  );
  const current = candidates.filter(
    (row) => (row._creationTime ?? -1) === creationTime,
  );
  return current.length === 1 &&
    current[0]?.enabled &&
    current[0].activatedAt !== undefined &&
    current[0].activatedAt <= now &&
    current[0].retiredAt === null
    ? current
    : [];
};

const appendAudit = async (
  context: AuthorityContext,
  operator: DeployAuthorityOperator,
  event: {
    readonly operation:
      | "issuer-provisioned"
      | "issuer-rotated"
      | "issuer-retired"
      | "approval-provisioned"
      | "census-provisioned"
      | "verdict-provisioned";
    readonly subjectKind: "issuer" | "approval" | "census" | "verdict";
    readonly subjectId: string;
    readonly subjectFingerprint: string;
    readonly provenanceHash: string;
    readonly occurredAt: number;
  },
): Promise<void> => {
  const eventId = await sha256(
    canonical({
      schemaVersion: 1,
      kind: "deploy-authority-audit-event",
      ...event,
      actorHash: operator.actorHash,
      authorityOrigin: operator.authorityOrigin,
    }),
  );
  await context.db.insert("deployAuthorityAuditEvents", {
    eventId,
    ...event,
    actorHash: operator.actorHash,
    authorityOrigin: operator.authorityOrigin,
  });
};

const authorityProvenanceHash = (input: {
  readonly operation: string;
  readonly operator: DeployAuthorityOperator;
  readonly sourceReceiptHash: string;
  readonly subjectFingerprint: string;
  readonly occurredAt: number;
}) =>
  sha256(
    canonical({
      schemaVersion: 1,
      kind: "deploy-authority-provenance",
      operation: input.operation,
      actorHash: input.operator.actorHash,
      authorityOrigin: input.operator.authorityOrigin,
      sourceReceiptHash: input.sourceReceiptHash,
      subjectFingerprint: input.subjectFingerprint,
      occurredAt: input.occurredAt,
    }),
  );

const validIssuerInput = async (input: IssuerInput): Promise<boolean> =>
  input.issuerId === DEPLOY_AUTHORITY_ISSUER_ID &&
  shaPattern.test(input.publicKeyHash) &&
  shaPattern.test(input.sourceReceiptHash) &&
  input.publicKeySpki.length >= 32 &&
  input.publicKeySpki.length <= 4096 &&
  base64UrlPattern.test(input.publicKeySpki) &&
  input.publicKeyHash === (await sha256(input.publicKeySpki));

const validApprovalInput = (input: ApprovalInput, now: number): boolean =>
  validScope(input) &&
  input.issuerId === DEPLOY_AUTHORITY_ISSUER_ID &&
  shaPattern.test(input.issuerPublicKeyHash) &&
  shaPattern.test(input.approvalHash) &&
  shaPattern.test(input.sourceReceiptHash) &&
  validSignature(input.signature) &&
  validEvidenceWindow(input.issuedAt, input.expiresAt, now);

const validCensusInput = (input: CensusInput, now: number): boolean =>
  validScope(input) &&
  shaPattern.test(input.snapshotId) &&
  shaPattern.test(input.sourceReceiptHash) &&
  validTime(input.capturedAt) &&
  input.capturedAt <= now &&
  validTime(input.expiresAt) &&
  input.expiresAt > now &&
  input.expiresAt - input.capturedAt <= MAX_EVIDENCE_TTL_MS &&
  Number.isSafeInteger(input.pageCount) &&
  input.pageCount >= 1 &&
  Number.isSafeInteger(input.totalCount) &&
  input.totalCount >= 0 &&
  input.nextCursor === null &&
  input.runsJson.length <= 750_000 &&
  input.immutableBindingsJson.length <= 750_000;

const validVerdictInput = (input: VerdictInput, now: number): boolean =>
  validScope(input) &&
  input.issuerId === DEPLOY_AUTHORITY_ISSUER_ID &&
  shaPattern.test(input.issuerPublicKeyHash) &&
  shaPattern.test(input.approvalHash) &&
  shaPattern.test(input.verdictHash) &&
  shaPattern.test(input.censusSnapshotId) &&
  shaPattern.test(input.sourceReceiptHash) &&
  validSignature(input.signature) &&
  validEvidenceWindow(input.issuedAt, input.expiresAt, now);

const validScope = (input: {
  readonly environment: string;
  readonly targetId: string;
  readonly commitSha: string;
}): boolean =>
  (input.environment === "staging" || input.environment === "production") &&
  targetPattern.test(input.targetId) &&
  commitPattern.test(input.commitSha);

const validEvidenceWindow = (
  issuedAt: number,
  expiresAt: number,
  now: number,
): boolean =>
  validTime(issuedAt) &&
  issuedAt <= now &&
  validTime(expiresAt) &&
  expiresAt > now &&
  expiresAt - issuedAt <= MAX_EVIDENCE_TTL_MS;

const validTime = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

const validSignature = (value: string): boolean =>
  value.length >= 32 && value.length <= 2048 && base64UrlPattern.test(value);

const exactHttpsOrigin = (value: string): string | undefined => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
};

const ok = (resourceHash: string): AuthorityAdminResult => ({
  kind: "ok",
  resourceHash,
});

const blocked = (code: AuthorityAdminCode) =>
  ({ kind: "blocked", code }) as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
