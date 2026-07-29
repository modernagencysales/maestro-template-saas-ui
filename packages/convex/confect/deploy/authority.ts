import {
  internalMutationGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import {
  readPromotionAuthorityMode,
  readPromotionAuthorityPrivateKeyPkcs8Base64Url,
} from "../shared/env";
import {
  authenticateDeployAuthorityOperator,
  exportAuthorityAudit,
  provisionApproval as provisionApprovalRecord,
  provisionCensus as provisionCensusRecord,
  provisionIssuer as provisionIssuerRecord,
  provisionVerdict as provisionVerdictRecord,
  readAuthorityReadiness,
  readAuthorityStatus,
  retireIssuer as retireIssuerRecord,
  rotateIssuer as rotateIssuerRecord,
} from "../deployAuthority/admin";
import { consumeDeployAuthority } from "../deployAuthority/store";

const environment = v.union(v.literal("staging"), v.literal("production"));
const adminCode = v.union(
  v.literal("operator-unauthorized"),
  v.literal("operator-forbidden"),
  v.literal("authority-mode-missing"),
  v.literal("invalid-input"),
  v.literal("duplicate-record"),
  v.literal("scope-conflict"),
  v.literal("issuer-unavailable"),
  v.literal("signature-invalid"),
  v.literal("mixed-origin"),
  v.literal("not-found"),
);
const adminResult = v.union(
  v.object({ kind: v.literal("ok"), resourceHash: v.string() }),
  v.object({ kind: v.literal("blocked"), code: adminCode }),
);
const issuerArgs = {
  issuerId: v.string(),
  publicKeyHash: v.string(),
  publicKeySpki: v.string(),
  sourceReceiptHash: v.string(),
};
const approvalArgs = {
  environment,
  targetId: v.string(),
  commitSha: v.string(),
  issuerId: v.string(),
  issuerPublicKeyHash: v.string(),
  approvalHash: v.string(),
  signature: v.string(),
  issuedAt: v.number(),
  expiresAt: v.number(),
  sourceReceiptHash: v.string(),
};
const censusArgs = {
  snapshotId: v.string(),
  environment,
  targetId: v.string(),
  commitSha: v.string(),
  capturedAt: v.number(),
  expiresAt: v.number(),
  pageCount: v.number(),
  totalCount: v.number(),
  nextCursor: v.union(v.string(), v.null()),
  runsJson: v.string(),
  immutableBindingsJson: v.string(),
  sourceReceiptHash: v.string(),
};
const verdictArgs = {
  environment,
  targetId: v.string(),
  commitSha: v.string(),
  issuerId: v.string(),
  issuerPublicKeyHash: v.string(),
  approvalHash: v.string(),
  verdictHash: v.string(),
  censusSnapshotId: v.string(),
  signature: v.string(),
  issuedAt: v.number(),
  expiresAt: v.number(),
  sourceReceiptHash: v.string(),
};

const authenticate = async (context: {
  readonly auth: { readonly getUserIdentity: () => Promise<unknown> };
}) => authenticateDeployAuthorityOperator(await context.auth.getUserIdentity());

const authenticateMutation = async (context: {
  readonly auth: { readonly getUserIdentity: () => Promise<unknown> };
}) => {
  const authenticated = await authenticate(context);
  return authenticated.kind === "ok" &&
    readPromotionAuthorityMode() !== "authority"
    ? ({ kind: "blocked", code: "authority-mode-missing" } as const)
    : authenticated;
};

export const provisionIssuer = mutationGeneric({
  args: issuerArgs,
  returns: adminResult,
  handler: async (context, input) => {
    const authenticated = await authenticateMutation(context);
    return authenticated.kind === "blocked"
      ? authenticated
      : provisionIssuerRecord(
          context,
          authenticated.operator,
          input,
          Date.now(),
        );
  },
});

export const rotateIssuer = mutationGeneric({
  args: issuerArgs,
  returns: adminResult,
  handler: async (context, input) => {
    const authenticated = await authenticateMutation(context);
    return authenticated.kind === "blocked"
      ? authenticated
      : rotateIssuerRecord(context, authenticated.operator, input, Date.now());
  },
});

export const revokeIssuer = mutationGeneric({
  args: { issuerId: v.string(), sourceReceiptHash: v.string() },
  returns: adminResult,
  handler: async (context, input) => {
    const authenticated = await authenticateMutation(context);
    return authenticated.kind === "blocked"
      ? authenticated
      : retireIssuerRecord(context, authenticated.operator, input, Date.now());
  },
});

export const provisionApproval = mutationGeneric({
  args: approvalArgs,
  returns: adminResult,
  handler: async (context, input) => {
    const authenticated = await authenticateMutation(context);
    return authenticated.kind === "blocked"
      ? authenticated
      : provisionApprovalRecord(
          context,
          authenticated.operator,
          input,
          Date.now(),
        );
  },
});

export const provisionCensus = mutationGeneric({
  args: censusArgs,
  returns: adminResult,
  handler: async (context, input) => {
    const authenticated = await authenticateMutation(context);
    return authenticated.kind === "blocked"
      ? authenticated
      : provisionCensusRecord(
          context,
          authenticated.operator,
          input,
          Date.now(),
        );
  },
});

export const provisionVerdict = mutationGeneric({
  args: verdictArgs,
  returns: adminResult,
  handler: async (context, input) => {
    const authenticated = await authenticateMutation(context);
    return authenticated.kind === "blocked"
      ? authenticated
      : provisionVerdictRecord(
          context,
          authenticated.operator,
          input,
          Date.now(),
        );
  },
});

const statusValue = v.object({
  bounded: v.boolean(),
  totalIssuerCount: v.number(),
  activeIssuerCount: v.number(),
  malformedIssuerCount: v.number(),
  mixedOrigin: v.boolean(),
  authorityOrigin: v.string(),
  lastOperatorAuditAt: v.union(v.number(), v.null()),
});

export const status = queryGeneric({
  args: {},
  returns: v.union(
    v.object({ kind: v.literal("ok"), status: statusValue }),
    v.object({ kind: v.literal("blocked"), code: adminCode }),
  ),
  handler: async (context) => {
    const authenticated = await authenticate(context);
    return authenticated.kind === "blocked"
      ? authenticated
      : {
          kind: "ok" as const,
          status: await readAuthorityStatus(
            context,
            authenticated.operator,
            Date.now(),
          ),
        };
  },
});

export const readiness = queryGeneric({
  args: {},
  returns: v.union(
    v.object({
      kind: v.literal("ok"),
      readiness: v.object({
        ready: v.boolean(),
        authorityModeConfigured: v.boolean(),
        signingKeyConfigured: v.boolean(),
        activeIssuerCount: v.number(),
        issuerSetValid: v.boolean(),
      }),
    }),
    v.object({ kind: v.literal("blocked"), code: adminCode }),
  ),
  handler: async (context) => {
    const authenticated = await authenticate(context);
    return authenticated.kind === "blocked"
      ? authenticated
      : {
          kind: "ok" as const,
          readiness: await readAuthorityReadiness(
            context,
            authenticated.operator,
            Date.now(),
            {
              authorityMode: readPromotionAuthorityMode(),
              signingKeyConfigured: Boolean(
                readPromotionAuthorityPrivateKeyPkcs8Base64Url(),
              ),
            },
          ),
        };
  },
});

const auditEvent = v.object({
  eventId: v.string(),
  operation: v.union(
    v.literal("issuer-provisioned"),
    v.literal("issuer-rotated"),
    v.literal("issuer-retired"),
    v.literal("approval-provisioned"),
    v.literal("census-provisioned"),
    v.literal("verdict-provisioned"),
  ),
  actorHash: v.string(),
  authorityOrigin: v.string(),
  subjectKind: v.union(
    v.literal("issuer"),
    v.literal("approval"),
    v.literal("census"),
    v.literal("verdict"),
  ),
  subjectId: v.string(),
  subjectFingerprint: v.string(),
  provenanceHash: v.string(),
  occurredAt: v.number(),
});

export const auditExport = queryGeneric({
  args: {
    limit: v.number(),
    beforeOccurredAt: v.union(v.number(), v.null()),
  },
  returns: v.union(
    v.object({
      kind: v.literal("ok"),
      audit: v.object({
        events: v.array(auditEvent),
        nextBeforeOccurredAt: v.union(v.number(), v.null()),
        requestedByActorHash: v.string(),
      }),
    }),
    v.object({ kind: v.literal("blocked"), code: adminCode }),
  ),
  handler: async (context, input) => {
    const authenticated = await authenticate(context);
    return authenticated.kind === "blocked"
      ? authenticated
      : {
          kind: "ok" as const,
          audit: await exportAuthorityAudit(
            context,
            authenticated.operator,
            input,
          ),
        };
  },
});

export const consume = internalMutationGeneric({
  args: {
    environment: v.union(v.literal("staging"), v.literal("production")),
    targetId: v.string(),
    commitSha: v.string(),
    action: v.union(
      v.literal("preflight"),
      v.literal("convex"),
      v.literal("cloudflare"),
    ),
  },
  returns: v.any(),
  handler: async (context, scope) =>
    consumeDeployAuthority(context, scope, {
      nowMs: Date.now,
      authorityMode: readPromotionAuthorityMode(),
    }),
});
