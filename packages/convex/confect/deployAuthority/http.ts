import { makeFunctionReference } from "convex/server";
import {
  readPromotionAuthorityMode,
  readPromotionAuthorityPrivateKeyPkcs8Base64Url,
} from "../shared/env";
import {
  canonical,
  type DeployAuthorityPayload,
  type DeployAuthorityScope,
} from "./store";

const consumeRef = makeFunctionReference<"mutation">(
  "deploy/authority:consume",
);

export const handleDeployAuthorityHttpRequest = async (
  context: {
    readonly runMutation: (
      reference: unknown,
      scope: DeployAuthorityScope,
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
  let result: unknown;
  try {
    result = await context.runMutation(consumeRef, scope);
  } catch {
    return json({ kind: "blocked" }, 503);
  }
  if (!isAuthorized(result)) return json({ kind: "blocked" }, 403);
  try {
    const signature = await signPayload(
      result.payload,
      dependencies.privateKeyPkcs8Base64Url,
    );
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

const signPayload = async (
  payload: DeployAuthorityPayload,
  privateKeyPkcs8Base64Url: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodeBase64Url(privateKeyPkcs8Base64Url),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
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
