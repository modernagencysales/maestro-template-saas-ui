import type { ContractTransport } from "@maestro-template/template-core/productContract";

import type { AuthPolicy } from "./authPolicies";
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
  readonly policyFor: (surfaceId: string) => AuthPolicy | undefined;
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
  const policy = ctx.policyFor(request.surfaceId);
  if (
    policy === undefined ||
    !principalMatchesPolicy(request.principal, policy)
  ) {
    return {
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message: "Operation is not authorized.",
      },
    };
  }
  if (
    request.principal.kind === "apiKey" &&
    typeof request.input.workspaceId === "string" &&
    request.input.workspaceId !== request.principal.workspaceId
  ) {
    return {
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message: "Caller workspace does not match principal authority.",
      },
    };
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
