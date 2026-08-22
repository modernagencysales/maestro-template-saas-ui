import {
  compileAuthorizedWorkflowCensus,
  hashWorkflowCensusSnapshot,
  type AuthorizedWorkflowCensus,
  type OperatorCensusAuthorization,
  type WorkflowCensusBindingAuthority,
  type WorkflowCensusRun,
} from "./census.js";

export type OperatorCensusEndpointScope = {
  readonly environment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
};

export type OperatorCensusEndpointDependencies = {
  /** One store transaction derives principal and returns one stable, complete authority snapshot. */
  readonly readAuthorizedCensusTransaction: (input: {
    readonly scope: OperatorCensusEndpointScope;
    readonly candidateAuthorization: unknown;
  }) => Promise<
    | {
        readonly kind: "authorized";
        readonly authorization: OperatorCensusAuthorization;
        readonly snapshotId: string;
        readonly pageCount: number;
        readonly totalCount: number;
        readonly nextCursor: null;
        readonly runs: readonly WorkflowCensusRun[];
        readonly immutableBindings: readonly WorkflowCensusBindingAuthority[];
      }
    | { readonly kind: "denied" | "unavailable" }
  >;
  readonly nowMs: () => number;
};

export type OperatorCensusEndpointResult =
  | { readonly kind: "ok"; readonly census: AuthorizedWorkflowCensus }
  | {
      readonly kind: "blocked";
      readonly code: "invalid-request" | "unauthorized" | "census-unavailable";
      readonly detail: string;
    };

export const handleOperatorWorkflowCensus = async (
  request: unknown,
  dependencies: OperatorCensusEndpointDependencies,
): Promise<OperatorCensusEndpointResult> => {
  const parsed = parseRequest(request);
  if (parsed === undefined) {
    return blocked(
      "invalid-request",
      "Operator workflow census request has an invalid or open shape.",
    );
  }
  let current: Awaited<
    ReturnType<
      OperatorCensusEndpointDependencies["readAuthorizedCensusTransaction"]
    >
  >;
  try {
    current = await dependencies.readAuthorizedCensusTransaction({
      scope: parsed.scope,
      candidateAuthorization: parsed.authorization,
    });
  } catch {
    return blocked(
      "census-unavailable",
      "Authoritative census transaction is unavailable.",
    );
  }
  if (current.kind !== "authorized") {
    return blocked(
      current.kind === "denied" ? "unauthorized" : "census-unavailable",
      "Current operator authorization and census snapshot are required for this exact scope.",
    );
  }
  if (!authorizationMatchesScope(current.authorization, parsed.scope)) {
    return blocked(
      "unauthorized",
      "Current operator authorization does not match the exact census scope.",
    );
  }
  const now = dependencies.nowMs();
  const preflight = compileAuthorizedWorkflowCensus(
    {
      authorization: parsed.authorization,
      expectedAuthorization: current.authorization,
      runs: [],
    },
    { nowMs: () => now },
  );
  if (preflight.kind !== "compiled") {
    return blocked(
      "unauthorized",
      "Current operator authorization is stale, invalid, or scope-mismatched.",
    );
  }
  if (
    !isSha256(current.snapshotId) ||
    !Number.isSafeInteger(current.pageCount) ||
    current.pageCount < 1 ||
    !Number.isSafeInteger(current.totalCount) ||
    current.totalCount < 0 ||
    current.nextCursor !== null ||
    current.totalCount !== current.runs.length
  ) {
    return blocked(
      "census-unavailable",
      "Active/restartable workflow census snapshot is incomplete.",
    );
  }
  if (
    current.snapshotId !==
    hashWorkflowCensusSnapshot({
      pageCount: current.pageCount,
      totalCount: current.totalCount,
      nextCursor: current.nextCursor,
      runs: current.runs,
      immutableBindings: current.immutableBindings,
    })
  ) {
    return blocked(
      "census-unavailable",
      "Active/restartable workflow census snapshot fingerprint is invalid.",
    );
  }
  const compiled = compileAuthorizedWorkflowCensus(
    {
      authorization: parsed.authorization,
      expectedAuthorization: current.authorization,
      runs: current.runs,
      expectedBindings: current.immutableBindings,
    },
    { nowMs: () => now },
  );
  if (compiled.kind !== "compiled") {
    return blocked(
      "census-unavailable",
      "Active/restartable workflow census result failed validation.",
    );
  }
  return Object.freeze({ kind: "ok", census: compiled.census });
};

const authorizationMatchesScope = (
  authorization: OperatorCensusAuthorization,
  scope: OperatorCensusEndpointScope,
): boolean =>
  authorization.environment === scope.environment &&
  authorization.targetId === scope.targetId &&
  authorization.commitSha === scope.commitSha &&
  authorization.artifactHash === scope.artifactHash;

const parseRequest = (
  input: unknown,
):
  | {
      readonly scope: OperatorCensusEndpointScope;
      readonly authorization: unknown;
    }
  | undefined => {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "environment",
      "targetId",
      "commitSha",
      "artifactHash",
      "authorization",
    ]) ||
    (input.environment !== "staging" && input.environment !== "production") ||
    !isBoundedId(input.targetId) ||
    !isCommit(input.commitSha) ||
    !isSha256(input.artifactHash) ||
    !isRecord(input.authorization)
  ) {
    return undefined;
  }
  return Object.freeze({
    scope: Object.freeze({
      environment: input.environment,
      targetId: input.targetId,
      commitSha: input.commitSha,
      artifactHash: input.artifactHash,
    }),
    authorization: input.authorization,
  });
};

const blocked = (
  code: Extract<OperatorCensusEndpointResult, { kind: "blocked" }>["code"],
  detail: string,
): OperatorCensusEndpointResult =>
  Object.freeze({ kind: "blocked", code, detail });

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const hasExactKeys = (
  input: Record<string, unknown>,
  keys: readonly string[],
): boolean =>
  Object.keys(input).length === keys.length &&
  keys.every((key) => Object.hasOwn(input, key));

const isBoundedId = (input: unknown): input is string =>
  typeof input === "string" && /^[a-z][a-z0-9-]{0,62}$/.test(input);

const isCommit = (input: unknown): input is string =>
  typeof input === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(input);

const isSha256 = (input: unknown): input is string =>
  typeof input === "string" && /^sha256:[0-9a-f]{64}$/.test(input);
