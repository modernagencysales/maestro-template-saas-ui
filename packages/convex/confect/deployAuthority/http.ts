import { makeFunctionReference } from "convex/server";
import {
  readPromotionAuthorityMode,
  readPromotionAuthorityPrivateKeyPkcs8Base64Url,
} from "./env";
import {
  canonical,
  type DeployAuthorityPayload,
  type DeployAuthorityScope,
  runtimeSigningKeyProofPayload,
  verifyIssuerSignature,
} from "./store";

const consumeRef = makeFunctionReference<"mutation">(
  "deploy/authority:consume",
);
const runtimeSigningIssuerRef = makeFunctionReference<"query">(
  "deploy/authority:runtimeSigningIssuer",
);

export const handleDeployAuthorityHttpRequest = async (
  context: {
    readonly runQuery: (
      reference: unknown,
      input: Record<string, never>,
    ) => Promise<unknown>;
    readonly runMutation: (
      reference: unknown,
      input: DeployAuthorityScope & {
        readonly expectedIssuerPublicKeyHash: string;
        readonly runtimeSigningKeyProofSignature: string;
      },
    ) => Promise<unknown>;
  },
  request: Request,
  dependencies: {
    readonly privateKeyPkcs8Base64Url: string | undefined;
    readonly authorityMode: "authority" | undefined;
  } = {
    privateKeyPkcs8Base64Url: readPromotionAuthorityPrivateKeyPkcs8Base64Url(),
    authorityMode: readPromotionAuthorityMode(),
  },
): Promise<Response> => {
  const scope = await parseScope(request);
  if (
    scope === undefined ||
    dependencies.authorityMode !== "authority" ||
    !dependencies.privateKeyPkcs8Base64Url
  )
    return json({ kind: "blocked" }, 503);
  let prepared: Awaited<ReturnType<typeof prepareSigningKey>>;
  let issuer: unknown;
  try {
    prepared = await prepareSigningKey(dependencies.privateKeyPkcs8Base64Url);
    issuer = await context.runQuery(runtimeSigningIssuerRef, {});
  } catch {
    return json({ kind: "blocked" }, 503);
  }
  if (
    !isRuntimeSigningIssuer(issuer) ||
    !(await verifyIssuerSignature(
      issuer.publicKeySpki,
      canonical(runtimeSigningKeyProofPayload),
      prepared.proofSignature,
    ))
  )
    return json({ kind: "blocked" }, 503);
  let result: unknown;
  try {
    result = await context.runMutation(consumeRef, {
      ...scope,
      expectedIssuerPublicKeyHash: issuer.publicKeyHash,
      runtimeSigningKeyProofSignature: prepared.proofSignature,
    });
  } catch {
    return json({ kind: "blocked" }, 503);
  }
  if (!isAuthorized(result)) return json({ kind: "blocked" }, 403);
  try {
    const signature = await signPayload(result.payload, prepared.key);
    return json({
      kind: "ok",
      authorization: { ...result.payload, signature },
    });
  } catch {
    return json({ kind: "blocked" }, 503);
  }
};

const parseScope = async (
  request: Request,
): Promise<DeployAuthorityScope | undefined> => {
  if (request.method !== "POST") return undefined;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return undefined;
  }
  if (
    !isRecord(body) ||
    Object.keys(body).length !== 4 ||
    (body.environment !== "staging" && body.environment !== "production") ||
    typeof body.targetId !== "string" ||
    !/^[a-z][a-z0-9-]{0,62}$/.test(body.targetId) ||
    typeof body.commitSha !== "string" ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(body.commitSha) ||
    (body.action !== "preflight" &&
      body.action !== "convex" &&
      body.action !== "cloudflare")
  )
    return undefined;
  return {
    environment: body.environment,
    targetId: body.targetId,
    commitSha: body.commitSha,
    action: body.action,
  };
};

const prepareSigningKey = async (
  privateKeyPkcs8Base64Url: string,
): Promise<{ readonly key: CryptoKey; readonly proofSignature: string }> => {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodeBase64Url(privateKeyPkcs8Base64Url),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const proofSignature = await signPayload(runtimeSigningKeyProofPayload, key);
  return { key, proofSignature };
};

export const createRuntimeSigningKeyProofSignature = async (
  privateKeyPkcs8Base64Url: string | undefined,
): Promise<string | undefined> => {
  if (!privateKeyPkcs8Base64Url) return undefined;
  try {
    return (await prepareSigningKey(privateKeyPkcs8Base64Url)).proofSignature;
  } catch {
    return undefined;
  }
};

const signPayload = async (
  payload: DeployAuthorityPayload | typeof runtimeSigningKeyProofPayload,
  key: CryptoKey,
): Promise<string> => {
  const signature = await crypto.subtle.sign(
    "Ed25519",
    key,
    new TextEncoder().encode(canonical(payload)),
  );
  return encodeBase64Url(new Uint8Array(signature));
};

const isAuthorized = (
  value: unknown,
): value is {
  readonly kind: "authorized";
  readonly payload: DeployAuthorityPayload;
} => isRecord(value) && value.kind === "authorized" && isRecord(value.payload);
const isRuntimeSigningIssuer = (
  value: unknown,
): value is {
  readonly publicKeyHash: string;
  readonly publicKeySpki: string;
} =>
  isRecord(value) &&
  typeof value.publicKeyHash === "string" &&
  typeof value.publicKeySpki === "string";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
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
const encodeBase64Url = (value: Uint8Array): string =>
  btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
