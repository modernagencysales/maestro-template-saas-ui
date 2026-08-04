import type { ContractTransport } from "@maestro-template/template-core/product-contract";
import { admittedJourneys } from "@maestro-template/template-core/generated/admittedJourneys";
import { confectManifest } from "@maestro-template/template-core/generated/confectManifest";
import type { PublicSurface } from "@maestro-template/template-core/publicSurface";

import { resolveAuthPolicy, type AuthPolicy } from "./authPolicies";
import { requireAdmittedSurfaceFrom } from "./admissionGuard";
import type { Principal } from "./principal";
import {
  executeHeadlessOperation,
  type HeadlessExecutionAdapter,
  type HeadlessExecutorResult,
  type HeadlessSurface,
  type JsonValue,
} from "../../manifest/executor";

export type AuthorizedOperationRequest = {
  readonly surfaceId: string;
  readonly operationId: string;
  readonly principal: Principal;
  readonly input: Record<string, JsonValue>;
  readonly idempotencyKey?: string;
  readonly correlationNonce?: string;
};

export type AuthorizedDispatchContext = {
  readonly adapter: HeadlessExecutionAdapter;
  readonly surfaces?: readonly PublicSurface[];
  readonly journeys?: Readonly<Record<string, boolean>>;
  readonly emergencyDenied?: boolean;
  readonly authenticate: (
    principal: Principal,
    policy: AuthPolicy,
    request: AuthorizedOperationRequest,
  ) => Promise<unknown>;
  readonly authorize: (
    principal: Principal,
    policy: AuthPolicy,
    request: AuthorizedOperationRequest,
  ) => Promise<void>;
};

export const principalSurfaceFor = (
  transport: ContractTransport,
): "web" | "api" | "cli" | "mcp" | "webhook" =>
  transport === "ui" ? "web" : transport;

const headlessSurfaceFor = (surface: Principal["surface"]): HeadlessSurface =>
  surface === "web" ? "api" : (surface as HeadlessSurface);

const publicTransportFor = (
  surface: Principal["surface"],
): PublicSurface["transport"] | undefined =>
  surface === "web"
    ? "ui"
    : surface === "api" ||
        surface === "cli" ||
        surface === "mcp" ||
        surface === "webhook"
      ? surface
      : undefined;

const validationFailure = (message: string): HeadlessExecutorResult => ({
  ok: false,
  error: { _tag: "ValidationFailed", message },
});

const generatedSurfaceFor = (
  surfaceId: string,
  operationId: string,
): PublicSurface | undefined => {
  const operation = confectManifest.functions.find(
    (candidate) => candidate.operationId === operationId,
  );
  const binding = (
    operation as typeof operation & {
      readonly authorizationBindings?: readonly {
        readonly id: string;
        readonly surface: "api" | "cli" | "mcp" | "web";
        readonly coverageTag: `@covers_${string}`;
        readonly authPolicyId?: `auth_${string}`;
      }[];
    }
  )?.authorizationBindings?.find((candidate) => candidate.id === surfaceId);
  return binding === undefined
    ? undefined
    : {
        id: binding.id,
        transport: binding.surface === "web" ? "ui" : binding.surface,
        coverageTag: binding.coverageTag,
        authPolicyId: binding.authPolicyId ?? "auth_deny_all",
        authority: {
          kind: "convex-function",
          registrationLocator: operationId,
        },
      };
};

const principalMatchesPolicy = (principal: Principal, policy: AuthPolicy) =>
  principal.kind === policy.principalKind &&
  (principal.kind !== "apiKey" ||
    policy.requiredScopes.every(
      (scope) =>
        principal.scopes.includes(scope) || principal.scopes.includes("admin"),
    ));

export const executeAuthorizedOperation = async (
  ctx: AuthorizedDispatchContext,
  request: AuthorizedOperationRequest,
): Promise<HeadlessExecutorResult> => {
  const generatedSurface = generatedSurfaceFor(
    request.surfaceId,
    request.operationId,
  );
  const surfaces = ctx.surfaces ?? (generatedSurface ? [generatedSurface] : []);
  const surface = surfaces.find(({ id }) => id === request.surfaceId);
  const transport = publicTransportFor(request.principal.surface);
  const policy =
    surface === undefined ? undefined : resolveAuthPolicy(surface.authPolicyId);
  if (
    surface === undefined ||
    surface.authority.kind !== "convex-function" ||
    surface.authority.registrationLocator !== request.operationId ||
    surface.transport !== transport ||
    policy === undefined ||
    !principalMatchesPolicy(request.principal, policy)
  ) {
    return validationFailure("Operation is not authorized.");
  }

  await ctx.authenticate(request.principal, policy, request);
  requireAdmittedSurfaceFrom(
    surface.id,
    ctx.emergencyDenied ?? false,
    surfaces,
    ctx.journeys ?? admittedJourneys,
  );

  if (
    request.principal.kind === "apiKey" &&
    typeof request.input.workspaceId === "string" &&
    request.input.workspaceId !== request.principal.workspaceId
  ) {
    return validationFailure(
      "Caller workspace does not match principal authority.",
    );
  }
  await ctx.authorize(request.principal, policy, request);
  return await executeHeadlessOperation(ctx.adapter, {
    operationId: request.operationId,
    surface: headlessSurfaceFor(request.principal.surface),
    input: request.input,
    ...(request.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: request.idempotencyKey }),
  });
};
