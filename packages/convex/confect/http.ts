import { confectManifest } from "@maestro-template/template-core/generated/confectManifest";
import {
  httpActionGeneric,
  httpRouter,
  makeFunctionReference,
} from "convex/server";
import { api } from "../convex/_generated/api";
import { verifyEmailUnsubscribeToken } from "./email/unsubscribeToken";
import { readEmailHttpEnv } from "./email/env";
import {
  normalizePostmarkEvent,
  verifyPostmarkBasicAuth,
} from "./email/postmarkWebhook";
import { handleDeployAuthorityHttpRequest } from "./deployAuthority/http";
import { type HeadlessExecutorRequest } from "./manifest/executor";
import { buildGeneratedOpenApiDocument } from "./manifest/openapi";
import { executeAuthorizedOperation } from "./capabilities/_kit/authorizedDispatch";
import {
  resolveAuthPolicy,
  type AuthPolicy,
} from "./capabilities/_kit/authPolicies";
import type { Principal } from "./capabilities/_kit/principal";
import { authenticateApiKey, type ApiKeyRow } from "./headless/auth";
import {
  executorRequestFor,
  readJsonBody,
  type TemplateApiRequestBody,
} from "./httpRequest";

type ManifestFunction = (typeof confectManifest.functions)[number];

const hasSurface = (entry: ManifestFunction, surface: string): boolean =>
  (entry.surfaces as readonly string[]).includes(surface);

const authorizedSurfaceFor = (operationId: string, transport: "ui" | "api") => {
  const operation = confectManifest.functions.find(
    (candidate) => candidate.operationId === operationId,
  );
  return (
    operation as typeof operation & {
      readonly authorizationBindings?: readonly {
        readonly id: string;
        readonly surface: "api" | "cli" | "mcp" | "web";
        readonly authPolicyId?: `auth_${string}`;
      }[];
    }
  )?.authorizationBindings?.find(
    (binding) =>
      (binding.surface === "web" ? "ui" : binding.surface) === transport,
  );
};

export type TemplateHttpRoute = {
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly kind: "http-route" | "webhook";
  readonly description: string;
};

export type HeadlessHttpCtx = {
  readonly authenticate?: (input: {
    readonly authorization: string | undefined;
    readonly policy: AuthPolicy;
    readonly surface: "web" | "api";
  }) => Promise<Principal>;
  readonly authorize?: (request: HeadlessExecutorRequest) => Promise<unknown>;
  readonly runQuery: (
    ref: unknown,
    input: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly runMutation: (
    ref: unknown,
    input: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly runAction: (
    ref: unknown,
    input: Record<string, unknown>,
  ) => Promise<unknown>;
};

const requireHttpAuthentication = async (
  ctx: HeadlessHttpCtx,
  input: Parameters<NonNullable<HeadlessHttpCtx["authenticate"]>>[0],
): Promise<Principal> => {
  if (ctx.authenticate === undefined)
    throw new Error("HTTP authentication adapter is required");
  return await ctx.authenticate(input);
};

const requireHttpAuthorization = async (
  ctx: HeadlessHttpCtx,
  request: HeadlessExecutorRequest,
): Promise<void> => {
  if (ctx.authorize === undefined)
    throw new Error("HTTP authorization adapter is required");
  await ctx.authorize(request);
};

type TemplateRouteMatch =
  | { readonly kind: "openapi" }
  | { readonly kind: "docs" }
  | { readonly kind: "dodoWebhook" }
  | { readonly kind: "postmarkWebhook" }
  | { readonly kind: "emailUnsubscribe" }
  | { readonly kind: "operation"; readonly operationId: string }
  | { readonly kind: "notFound"; readonly pathname: string };

const staticTemplateRoutes: Record<string, TemplateRouteMatch | undefined> = {
  "/api/openapi.json": { kind: "openapi" },
  "/api/docs": { kind: "docs" },
  "/webhooks/dodo": { kind: "dodoWebhook" },
  "/webhooks/email/postmark": { kind: "postmarkWebhook" },
  "/email/unsubscribe": { kind: "emailUnsubscribe" },
};

const operationRefs = {
  "brain.pages.createMarkdown": api.brain.pages.createMarkdown,
  "ops.email.previewBroadcast": (
    api as unknown as {
      readonly ops: {
        readonly email: { readonly previewBroadcast: unknown };
      };
    }
  ).ops.email.previewBroadcast,
  "ops.email.dispatchBroadcast": (
    api as unknown as {
      readonly ops: {
        readonly email: { readonly dispatchBroadcast: unknown };
      };
    }
  ).ops.email.dispatchBroadcast,
} satisfies Record<string, unknown>;

const dodoWebhookActionRef = makeFunctionReference<
  "action",
  {
    readonly rawBody: string;
    readonly webhookId: string;
    readonly signature?: string;
    readonly signatureTimestamp?: string;
  },
  { readonly eventId: string; readonly status: "processed" | "duplicate" }
>("commerce/webhooks:applyDodo");

const postmarkEventMutationRef = makeFunctionReference<
  "mutation",
  {
    readonly fingerprint: string;
    readonly kind:
      | "delivery"
      | "hard_bounce"
      | "soft_bounce"
      | "spam_complaint"
      | "subscription_change"
      | "open"
      | "click";
    readonly recipient: string;
    readonly providerMessageId?: string;
  },
  { readonly status: "processed" | "duplicate"; readonly suppressed: boolean }
>("ops/email:processProviderEvent");

const unsubscribeMutationRef = makeFunctionReference<
  "mutation",
  { readonly subscriberId: string },
  unknown
>("ops/email:unsubscribe");

const httpAuthorizationQueryRef = makeFunctionReference<
  "query",
  { readonly operationId: string; readonly workspaceId: string },
  null
>("httpAuthorization:authorize");

const httpSessionPrincipalQueryRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { readonly userId: string; readonly subject: string }
>("httpAuthorization:sessionPrincipal");

const apiKeyByHashQueryRef = makeFunctionReference<
  "query",
  { readonly keyHash: string },
  ApiKeyRow | null
>("httpAuthorization:apiKeyByHash");

export const securityHeaders = {
  "content-security-policy":
    "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
} as const;

export const templateHttpRoutes = [
  {
    path: "/webhooks/dodo",
    method: "POST",
    kind: "webhook",
    description: "Verifies and applies a Dodo payment webhook.",
  },
  {
    path: "/webhooks/email/postmark",
    method: "POST",
    kind: "webhook",
    description: "Authenticates and normalizes a Postmark delivery event.",
  },
  {
    path: "/email/unsubscribe",
    method: "GET",
    kind: "http-route",
    description: "Shows the email unsubscribe confirmation page.",
  },
  {
    path: "/email/unsubscribe",
    method: "POST",
    kind: "http-route",
    description: "Applies a signed one-click marketing unsubscribe.",
  },
  {
    path: "/api/openapi.json",
    method: "GET",
    kind: "http-route",
    description: "Serves the generated OpenAPI 3.1 document.",
  },
  {
    path: "/api/docs",
    method: "GET",
    kind: "http-route",
    description: "Serves the Scalar API documentation shell.",
  },
  ...confectManifest.functions
    .filter((entry) => hasSurface(entry, "api"))
    .map((entry) => ({
      path: `/api/${entry.operationId}`,
      method: "POST" as const,
      kind: "http-route" as const,
      description: `Executes ${entry.operationId}.`,
    })),
] as const satisfies readonly TemplateHttpRoute[];

const withSecurityHeaders = (
  headers: HeadersInit = {},
): Record<string, string> => {
  const merged: Record<string, string> = { ...securityHeaders };
  new Headers(headers).forEach((value, key) => {
    merged[key] = value;
  });
  return merged;
};

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      ...securityHeaders,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const scalarDocsHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Maestro Template API Docs</title>
    <script id="api-reference" data-url="/api/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </head>
  <body>
    <noscript>OpenAPI JSON is available at /api/openapi.json.</noscript>
  </body>
</html>
`;

const htmlResponse = (html: string): Response =>
  new Response(html, {
    headers: withSecurityHeaders({
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    }),
  });

const unsubscribeHtmlResponse = (html: string): Response =>
  new Response(html, {
    headers: withSecurityHeaders({
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    }),
  });

const runTemplateApiOperation = async (
  ctx: HeadlessHttpCtx,
  request: HeadlessExecutorRequest,
  authorization: string | undefined,
): Promise<unknown> => {
  const transport = authorization?.match(/^Bearer\s+mtk_live_/iu)
    ? "api"
    : "ui";
  const surface = authorizedSurfaceFor(request.operationId, transport);
  const policy =
    surface === undefined
      ? undefined
      : resolveAuthPolicy(surface.authPolicyId ?? "auth_deny_all");
  if (surface === undefined || policy === undefined)
    throw new Error("HTTP operation has no generated authorization surface");
  const principal = await requireHttpAuthentication(ctx, {
    authorization,
    policy,
    surface: transport === "ui" ? "web" : "api",
  });

  return await executeAuthorizedOperation(
    {
      adapter: {
        refs: operationRefs,
        runQuery: (ref, input) => ctx.runQuery(ref, input),
        runMutation: (ref, input) => ctx.runMutation(ref, input),
        runAction: (ref, input) => ctx.runAction(ref, input),
      },
      authenticate: async () => principal,
      authorize: async (verifiedPrincipal) =>
        verifiedPrincipal.kind === "apiKey"
          ? undefined
          : requireHttpAuthorization(ctx, request),
    },
    {
      surfaceId: surface.id,
      operationId: request.operationId,
      principal,
      input: request.input,
      ...(request.idempotencyKey === undefined
        ? {}
        : { idempotencyKey: request.idempotencyKey }),
    },
  );
};

const templateRouteForPath = (pathname: string): TemplateRouteMatch => {
  const apiEntry = confectManifest.functions.find(
    (entry) =>
      hasSurface(entry, "api") && `/api/${entry.operationId}` === pathname,
  );
  const route =
    staticTemplateRoutes[pathname] ??
    (apiEntry
      ? { kind: "operation", operationId: apiEntry.operationId }
      : { kind: "notFound", pathname });

  return route;
};

const templateRouteResponse = async (
  ctx: HeadlessHttpCtx,
  request: Request,
  route: TemplateRouteMatch,
): Promise<Response> => {
  let response: Response;

  switch (route.kind) {
    case "openapi":
      response = openApiRouteResponse(request);
      break;
    case "docs":
      response = docsRouteResponse(request);
      break;
    case "dodoWebhook":
      response = await dodoWebhookRouteResponse(ctx, request);
      break;
    case "postmarkWebhook":
      response = await postmarkWebhookRouteResponse(ctx, request);
      break;
    case "emailUnsubscribe":
      response = await emailUnsubscribeRouteResponse(ctx, request);
      break;
    case "operation":
      response = await operationRouteResponse(ctx, request, route.operationId);
      break;
    case "notFound":
      response = notFoundRouteResponse(route.pathname);
      break;
  }

  return response;
};

const postmarkWebhookRouteResponse = async (
  ctx: HeadlessHttpCtx,
  request: Request,
): Promise<Response> => {
  const emailEnv = readEmailHttpEnv();

  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: {
          _tag: "MethodNotAllowed",
          message: "Only POST is supported for /webhooks/email/postmark.",
        },
      },
      405,
    );
  }
  if (
    !verifyPostmarkBasicAuth({
      authorization: request.headers.get("authorization"),
      username: emailEnv.POSTMARK_WEBHOOK_USERNAME,
      password: emailEnv.POSTMARK_WEBHOOK_PASSWORD,
    })
  ) {
    return jsonResponse(
      {
        ok: false,
        error: {
          _tag: "Unauthorized",
          message: "Webhook authentication failed.",
        },
      },
      401,
    );
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: {
          _tag: "ValidationFailed",
          message: "Webhook JSON is invalid.",
        },
      },
      400,
    );
  }
  const event = await normalizePostmarkEvent(payload);
  if (event === null) {
    return jsonResponse(
      {
        ok: false,
        error: {
          _tag: "ValidationFailed",
          message: "Webhook event is unsupported.",
        },
      },
      400,
    );
  }
  return jsonResponse(await ctx.runMutation(postmarkEventMutationRef, event));
};

const unsubscribePage = (token: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head>
<body><main><h1>Stop marketing emails?</h1><p>Transactional account and purchase emails will continue.</p><form method="post"><input type="hidden" name="token" value="${token.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"><button type="submit">Unsubscribe</button></form></main></body></html>`;

const emailUnsubscribeRouteResponse = async (
  ctx: HeadlessHttpCtx,
  request: Request,
): Promise<Response> => {
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: {
          _tag: "MethodNotAllowed",
          message: "Only GET and POST are supported for /email/unsubscribe.",
        },
      },
      405,
    );
  }
  const url = new URL(request.url);
  const formToken =
    request.method === "POST"
      ? new URLSearchParams(await request.text()).get("token")
      : null;
  const token = formToken ?? url.searchParams.get("token") ?? "";
  const secret = readEmailHttpEnv().EMAIL_UNSUBSCRIBE_SECRET;
  const verified = secret
    ? await verifyEmailUnsubscribeToken({ token, secret })
    : null;
  if (verified === null) {
    return jsonResponse(
      {
        ok: false,
        error: {
          _tag: "ValidationFailed",
          message: "Unsubscribe link is invalid or expired.",
        },
      },
      400,
    );
  }
  if (request.method === "GET")
    return unsubscribeHtmlResponse(unsubscribePage(token));
  await ctx.runMutation(unsubscribeMutationRef, {
    subscriberId: verified.subscriberId,
  });
  return unsubscribeHtmlResponse(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unsubscribed</title></head><body><main><h1>You are unsubscribed.</h1><p>You will no longer receive marketing emails.</p></main></body></html>',
  );
};

const dodoWebhookRouteResponse = async (
  ctx: HeadlessHttpCtx,
  request: Request,
): Promise<Response> => {
  if (request.method !== "POST")
    return jsonResponse({
      ok: false,
      error: {
        _tag: "MethodNotAllowed",
        message: "Only POST is supported for /webhooks/dodo.",
      },
    });

  const rawBody = await request.text();
  const result = await ctx.runAction(dodoWebhookActionRef, {
    rawBody,
    webhookId: request.headers.get("webhook-id") ?? "",
    signature: request.headers.get("webhook-signature") ?? "",
    signatureTimestamp: request.headers.get("webhook-timestamp") ?? "",
  });
  return jsonResponse(result);
};

const openApiRouteResponse = (request: Request): Response =>
  request.method === "GET"
    ? jsonResponse(buildGeneratedOpenApiDocument())
    : jsonResponse({
        ok: false,
        error: {
          _tag: "MethodNotAllowed",
          message: "Only GET is supported for OpenAPI docs.",
        },
      });

const docsRouteResponse = (request: Request): Response =>
  request.method === "GET"
    ? htmlResponse(scalarDocsHtml())
    : jsonResponse({
        ok: false,
        error: {
          _tag: "MethodNotAllowed",
          message: "Only GET is supported for Scalar docs.",
        },
      });

const operationRouteResponse = async (
  ctx: HeadlessHttpCtx,
  request: Request,
  operationId: string,
): Promise<Response> => {
  const response =
    request.method === "POST"
      ? await executeTemplateApiRoute(ctx, request, operationId)
      : jsonResponse({
          ok: false,
          error: {
            _tag: "MethodNotAllowed",
            message: `Only POST is supported for /api/${operationId}.`,
          },
        });

  return response;
};

const executeTemplateApiRoute = async (
  ctx: HeadlessHttpCtx,
  request: Request,
  operationId: string,
): Promise<Response> => {
  const parsedBody = await readJsonBody(request);
  const response = parsedBody.ok
    ? await responseForParsedTemplateApiBody(
        ctx,
        operationId,
        parsedBody.body,
        request.headers.get("authorization") ?? undefined,
      )
    : jsonResponse(parsedBody);

  return response;
};

const responseForParsedTemplateApiBody = async (
  ctx: HeadlessHttpCtx,
  operationId: string,
  body: TemplateApiRequestBody,
  authorization?: string,
): Promise<Response> => {
  const executorRequest = executorRequestFor(operationId, body);
  const response = executorRequest.ok
    ? jsonResponse(
        await runTemplateApiOperation(
          ctx,
          executorRequest.request,
          authorization,
        ),
      )
    : jsonResponse(executorRequest);

  return response;
};

const notFoundRouteResponse = (pathname: string): Response =>
  jsonResponse({
    ok: false,
    error: {
      _tag: "NotFound",
      message: `Unknown template HTTP route: ${pathname}`,
    },
  });

export const handleTemplateHttpRequest = async (
  ctx: HeadlessHttpCtx,
  request: Request,
): Promise<Response> => {
  const url = new URL(request.url);
  const response = await templateRouteResponse(
    ctx,
    request,
    templateRouteForPath(url.pathname),
  );

  return response;
};

/**
 * The deployable router. Convex requires convex/http's default export to be
 * an httpRouter, so every declared route is mounted onto one here; dispatch
 * (including the fail-closed 404) stays in handleTemplateHttpRequest above.
 */
const buildTemplateHttpRouter = () => {
  const router = httpRouter();
  router.route({
    path: "/deploy-authority/consume",
    method: "POST",
    handler: httpActionGeneric((ctx, request) =>
      handleDeployAuthorityHttpRequest(
        {
          runQuery: (reference, input) =>
            ctx.runQuery(reference as never, input as never),
          runMutation: (reference, scope) =>
            ctx.runMutation(reference as never, scope as never),
        },
        request,
      ),
    ),
  });
  const handler = httpActionGeneric(async (ctx, request) => {
    const headlessCtx: HeadlessHttpCtx = {
      authenticate: async ({ authorization, policy, surface }) => {
        if (policy.credential === "api-key")
          return await authenticateApiKey({
            authorization,
            policy,
            surface: "api",
            nowMs: Date.now(),
            loadByHash: (keyHash) =>
              ctx.runQuery(apiKeyByHashQueryRef, { keyHash }),
          });
        const principal = await ctx.runQuery(httpSessionPrincipalQueryRef, {});
        return {
          kind: "user",
          userId: principal.userId as never,
          subject: principal.subject,
          surface: "web",
        };
      },
      authorize: async (operationRequest) => {
        const workspaceId = operationRequest.input.workspaceId;
        if (typeof workspaceId !== "string" || workspaceId.trim() === "")
          throw new Error("HTTP authorization requires a workspace target");
        await ctx.runQuery(httpAuthorizationQueryRef, {
          operationId: operationRequest.operationId,
          workspaceId,
        });
      },
      runQuery: (ref, input) => ctx.runQuery(ref as never, input as never),
      runMutation: (ref, input) =>
        ctx.runMutation(ref as never, input as never),
      runAction: (ref, input) => ctx.runAction(ref as never, input as never),
    };

    return handleTemplateHttpRequest(headlessCtx, request);
  });
  for (const route of templateHttpRoutes) {
    router.route({ path: route.path, method: route.method, handler });
  }
  return router;
};

export default buildTemplateHttpRouter();
