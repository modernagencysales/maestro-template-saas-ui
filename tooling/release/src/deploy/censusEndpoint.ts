import {
  compileAuthorizedWorkflowCensus,
  type AuthorizedWorkflowCensus,
  type OperatorCensusAuthorization,
  type WorkflowCensusRun,
} from "./census.js";

export type OperatorCensusEndpointScope = {
  readonly environment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
};

export type OperatorCensusEndpointDependencies = {
  /** Derives the current operator from server context; no caller identity input. */
  readonly authorizeCurrentOperator: (input: {
    readonly scope: OperatorCensusEndpointScope;
    readonly candidateAuthorization: unknown;
  }) => Promise<
    | {
        readonly kind: "authorized";
        readonly authorization: OperatorCensusAuthorization;
      }
    | { readonly kind: "denied" }
  >;
  readonly loadActiveRestartableRuns: (input: {
    readonly scope: OperatorCensusEndpointScope;
    readonly authorizationHash: string;
  }) => Promise<
    | {
        readonly kind: "available";
        readonly runs: readonly WorkflowCensusRun[];
      }
    | { readonly kind: "unavailable" }
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
  const current = await dependencies.authorizeCurrentOperator({
    scope: parsed.scope,
    candidateAuthorization: parsed.authorization,
  });
  if (current.kind !== "authorized") {
    return blocked(
      "unauthorized",
      "Current operator authorization is required for this exact census scope.",
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
  let loaded: Awaited<
    ReturnType<OperatorCensusEndpointDependencies["loadActiveRestartableRuns"]>
  >;
  try {
    loaded = await dependencies.loadActiveRestartableRuns({
      scope: parsed.scope,
      authorizationHash: current.authorization.canonicalHash,
    });
  } catch {
    return blocked(
      "census-unavailable",
      "Active/restartable workflow census could not be read.",
    );
  }
  if (loaded.kind !== "available") {
    return blocked(
      "census-unavailable",
      "Active/restartable workflow census is unavailable.",
    );
  }
  const compiled = compileAuthorizedWorkflowCensus(
    {
      authorization: parsed.authorization,
      expectedAuthorization: current.authorization,
      runs: loaded.runs,
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
