import { createPublicKey, verify } from "node:crypto";

export type DeployAuthorityAction = "preflight" | "convex" | "cloudflare";
export type DurableDeployScope = {
  readonly environment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly action: DeployAuthorityAction;
};
export type DurableDeployAuthorizationPayload = DurableDeployScope & {
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
export type DurableDeployAuthorization = DurableDeployAuthorizationPayload & {
  readonly signature: string;
};
export const MAX_DURABLE_DEPLOY_AUTHORIZATION_TTL_MS = 60_000;
export const PINNED_DEPLOY_AUTHORITY_ISSUER_ID =
  "maestro-promotion-authority-v1";

export type DurablePromotionAuthorityStore = {
  /** One durable transaction: issuer/verdict/approval/census lookup plus unique action consume. */
  readonly authorizeAndConsume: (scope: DurableDeployScope) => Promise<
    | {
        readonly kind: "authorized";
        readonly payload: DurableDeployAuthorizationPayload;
      }
    | { readonly kind: "denied" | "replayed" | "unavailable" }
  >;
};

export const handleDurableDeployAuthority = async (
  request: unknown,
  dependencies: {
    readonly store: DurablePromotionAuthorityStore;
    readonly sign: (payload: string) => Promise<string>;
  },
): Promise<
  | { readonly kind: "ok"; readonly authorization: DurableDeployAuthorization }
  | { readonly kind: "blocked" }
> => {
  const scope = parseScope(request);
  if (scope === undefined) return { kind: "blocked" };
  let result: Awaited<
    ReturnType<DurablePromotionAuthorityStore["authorizeAndConsume"]>
  >;
  try {
    result = await dependencies.store.authorizeAndConsume(scope);
  } catch {
    return { kind: "blocked" };
  }
  if (
    result.kind !== "authorized" ||
    !isAuthorization({ ...result.payload, signature: "pending" }) ||
    result.payload.issuerId !== PINNED_DEPLOY_AUTHORITY_ISSUER_ID ||
    !payloadMatchesScope(result.payload, scope) ||
    result.payload.expiresAt - result.payload.issuedAt >
      MAX_DURABLE_DEPLOY_AUTHORIZATION_TTL_MS
  )
    return { kind: "blocked" };
  return {
    kind: "ok",
    authorization: Object.freeze({
      ...result.payload,
      signature: await dependencies.sign(canonical(result.payload)),
    }),
  };
};

export const requestDurableDeployAuthorization = async (
  scope: DurableDeployScope,
  dependencies: {
    readonly endpoint: string | undefined;
    readonly publicKeyPem: string;
    readonly nowMs: () => number;
    readonly fetch: typeof fetch;
  },
): Promise<DurableDeployAuthorization> => {
  const endpoint = validatePromotionAuthorityEndpoint(dependencies.endpoint);
  const response = await dependencies.fetch(
    `${endpoint}/deploy-authority/consume`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(scope),
    },
  );
  if (!response.ok)
    throw new Error("Durable promotion authority refused the request.");
  const body: unknown = await response.json();
  if (
    !isRecord(body) ||
    body.kind !== "ok" ||
    !isAuthorization(body.authorization)
  ) {
    throw new Error("Durable promotion authority returned an invalid receipt.");
  }
  const authorization = body.authorization;
  const now = dependencies.nowMs();
  if (
    authorization.issuerId !== PINNED_DEPLOY_AUTHORITY_ISSUER_ID ||
    !payloadMatchesScope(authorization, scope) ||
    now < authorization.issuedAt ||
    now >= authorization.expiresAt ||
    authorization.expiresAt - authorization.issuedAt >
      MAX_DURABLE_DEPLOY_AUTHORIZATION_TTL_MS
  ) {
    throw new Error(
      "Durable promotion authority receipt is stale or scope-mismatched.",
    );
  }
  const valid = verify(
    null,
    Buffer.from(canonical(payloadOf(authorization))),
    createPublicKey(dependencies.publicKeyPem),
    Buffer.from(authorization.signature, "base64url"),
  );
  if (!valid)
    throw new Error("Durable promotion authority signature is invalid.");
  return Object.freeze({ ...authorization });
};

export const validatePromotionAuthorityEndpoint = (
  endpoint: string | undefined,
  targetConvexUrl?: string,
): string => {
  if (!endpoint) throw new Error("Durable promotion authority is unavailable.");
  let authority: URL;
  try {
    authority = new URL(endpoint);
  } catch {
    throw new Error(
      "Durable promotion authority must use an independent HTTPS base URL.",
    );
  }
  if (
    authority.protocol !== "https:" ||
    authority.username !== "" ||
    authority.password !== "" ||
    authority.pathname !== "/" ||
    authority.search !== "" ||
    authority.hash !== ""
  ) {
    throw new Error(
      "Durable promotion authority must use an independent HTTPS base URL.",
    );
  }
  if (targetConvexUrl) {
    let target: URL;
    try {
      target = new URL(targetConvexUrl);
    } catch {
      throw new Error("Target Convex URL is invalid.");
    }
    if (
      authority.origin === target.origin ||
      sharesConvexDeployment(authority, target)
    ) {
      throw new Error(
        "Durable promotion authority must use an independent HTTPS base URL.",
      );
    }
  }
  return authority.origin;
};

const sharesConvexDeployment = (left: URL, right: URL): boolean => {
  const leftDeployment = convexDeploymentIdentity(left);
  return (
    leftDeployment !== undefined &&
    leftDeployment === convexDeploymentIdentity(right)
  );
};

const convexDeploymentIdentity = (url: URL): string | undefined => {
  for (const suffix of [".convex.cloud", ".convex.site"] as const) {
    if (!url.hostname.endsWith(suffix)) continue;
    const deployment = url.hostname.slice(0, -suffix.length);
    return /^[a-z0-9-]+$/u.test(deployment) ? deployment : undefined;
  }
  return undefined;
};

const parseScope = (input: unknown): DurableDeployScope | undefined => {
  if (
    !isRecord(input) ||
    (input.environment !== "staging" && input.environment !== "production") ||
    typeof input.targetId !== "string" ||
    !/^[a-z][a-z0-9-]{0,62}$/.test(input.targetId) ||
    typeof input.commitSha !== "string" ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(input.commitSha) ||
    (input.action !== "preflight" &&
      input.action !== "convex" &&
      input.action !== "cloudflare")
  )
    return undefined;
  return {
    environment: input.environment,
    targetId: input.targetId,
    commitSha: input.commitSha,
    action: input.action,
  };
};
const payloadMatchesScope = (
  value: DurableDeployAuthorizationPayload,
  scope: DurableDeployScope,
): boolean =>
  value.environment === scope.environment &&
  value.targetId === scope.targetId &&
  value.commitSha === scope.commitSha &&
  value.action === scope.action;
const isAuthorization = (input: unknown): input is DurableDeployAuthorization =>
  isRecord(input) &&
  hasExactKeys(input, [
    "schemaVersion",
    "kind",
    "environment",
    "targetId",
    "commitSha",
    "action",
    "issuerId",
    "verdictHash",
    "approvalHash",
    "censusFingerprint",
    "consumptionId",
    "issuedAt",
    "expiresAt",
    "signature",
  ]) &&
  input.schemaVersion === 1 &&
  input.kind === "durable-deploy-authorization" &&
  parseScope(input) !== undefined &&
  [input.verdictHash, input.approvalHash, input.censusFingerprint].every(
    isSha,
  ) &&
  typeof input.issuerId === "string" &&
  /^[a-z][a-z0-9-]{0,62}$/.test(input.issuerId) &&
  typeof input.consumptionId === "string" &&
  /^[A-Za-z0-9_-]{16,128}$/.test(input.consumptionId) &&
  Number.isSafeInteger(input.issuedAt) &&
  Number.isSafeInteger(input.expiresAt) &&
  (input.expiresAt as number) > (input.issuedAt as number) &&
  typeof input.signature === "string";
const payloadOf = (
  value: DurableDeployAuthorization,
): DurableDeployAuthorizationPayload => {
  const { signature, ...payload } = value;
  void signature;
  return payload;
};
const isSha = (value: unknown): boolean =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
};
