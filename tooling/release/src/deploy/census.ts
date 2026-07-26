import { createHash } from "node:crypto";

import type { PromotionWorkflowCensus } from "./contract.js";

export type OperatorCensusAuthorizationPayload = {
  readonly schemaVersion: 1;
  readonly kind: "operator-workflow-census-authorization";
  readonly principalClass: "operator";
  readonly environment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
};

export type OperatorCensusAuthorization = OperatorCensusAuthorizationPayload & {
  readonly canonicalHash: string;
};

export const MAX_OPERATOR_CENSUS_AUTHORIZATION_TTL_MS = 2 * 60 * 1_000;

export type WorkflowCensusRun = {
  readonly runFingerprint: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly status: "active" | "restartable";
  readonly runnerHash: string;
  readonly runtimeHash: string;
  readonly capabilityBindingsHash: string;
  readonly completionBindingHash: string;
};
export type WorkflowCensusRunPayload = Omit<
  WorkflowCensusRun,
  "runFingerprint"
>;

export type WorkflowCensusBindingAuthority = Omit<
  WorkflowCensusRun,
  "runFingerprint" | "status"
>;
export type WorkflowCensusSnapshotPayload = {
  readonly pageCount: number;
  readonly totalCount: number;
  readonly nextCursor: null;
  readonly runs: readonly WorkflowCensusRun[];
  readonly immutableBindings: readonly WorkflowCensusBindingAuthority[];
};

export type AuthorizedWorkflowCensusPayload = {
  readonly schemaVersion: 1;
  readonly kind: "authorized-workflow-census";
  readonly outcome: "no-workflows" | "workflows-present";
  readonly environment: "staging" | "production";
  readonly targetId: string;
  readonly commitSha: string;
  readonly artifactHash: string;
  readonly authorizationHash: string;
  readonly authorizationNonce: string;
  readonly capturedAt: number;
  readonly expiresAt: number;
  readonly active: number;
  readonly restartable: number;
  readonly runs: readonly WorkflowCensusRun[];
};

export type AuthorizedWorkflowCensus = AuthorizedWorkflowCensusPayload & {
  readonly fingerprint: string;
};

export type CompileWorkflowCensusInput = {
  readonly authorization: unknown;
  readonly expectedAuthorization: OperatorCensusAuthorization;
  readonly runs: readonly WorkflowCensusRun[];
  readonly expectedBindings?: readonly WorkflowCensusBindingAuthority[];
};

export type WorkflowCensusResult =
  | { readonly kind: "compiled"; readonly census: AuthorizedWorkflowCensus }
  | {
      readonly kind: "blocked";
      readonly code:
        | "invalid-authorization"
        | "authorization-mismatch"
        | "stale-authorization"
        | "invalid-runs";
      readonly findings: readonly string[];
    };

export type WorkflowCensusDependencies = {
  readonly nowMs: () => number;
};

export const hashOperatorCensusAuthorizationPayload = (
  payload: OperatorCensusAuthorizationPayload,
): string => sha256(canonicalJson(payload));
export const hashWorkflowCensusRun = (run: WorkflowCensusRunPayload): string =>
  sha256(canonicalJson(run));
export const hashWorkflowCensusSnapshot = (
  snapshot: WorkflowCensusSnapshotPayload,
): string => sha256(canonicalJson(snapshot));

export const compileAuthorizedWorkflowCensus = (
  input: CompileWorkflowCensusInput,
  dependencies: WorkflowCensusDependencies,
): WorkflowCensusResult => {
  const now = dependencies.nowMs();
  if (!isTime(now)) {
    return blocked("invalid-authorization", "Census clock is invalid.");
  }
  const authorization = parseAuthorization(input.authorization);
  if (authorization === undefined) {
    return blocked(
      "invalid-authorization",
      "Operator census authorization has an invalid or open shape.",
    );
  }
  if (
    hashOperatorCensusAuthorizationPayload(
      authorizationPayload(authorization),
    ) !== authorization.canonicalHash
  ) {
    return blocked(
      "invalid-authorization",
      "Operator census authorization hash is invalid.",
    );
  }
  if (
    canonicalJson(authorization) !== canonicalJson(input.expectedAuthorization)
  ) {
    return blocked(
      "authorization-mismatch",
      "Operator census authorization does not match the trusted authorization.",
    );
  }
  if (now < authorization.issuedAt || now >= authorization.expiresAt) {
    return blocked(
      "stale-authorization",
      "Operator census authorization is outside its validity window.",
    );
  }
  if (
    authorization.expiresAt - authorization.issuedAt >
    MAX_OPERATOR_CENSUS_AUTHORIZATION_TTL_MS
  ) {
    return blocked(
      "invalid-authorization",
      "Operator census authorization exceeds the maximum lifetime.",
    );
  }
  const runs = parseRuns(input.runs);
  if (!runs.ok) return blocked("invalid-runs", runs.finding);
  if (input.expectedBindings !== undefined) {
    const finding = validateBindings(runs.value, input.expectedBindings);
    if (finding !== undefined) return blocked("invalid-runs", finding);
  }
  const active = runs.value.filter(({ status }) => status === "active").length;
  const restartable = runs.value.length - active;
  const payload: AuthorizedWorkflowCensusPayload = {
    schemaVersion: 1,
    kind: "authorized-workflow-census",
    outcome: runs.value.length === 0 ? "no-workflows" : "workflows-present",
    environment: authorization.environment,
    targetId: authorization.targetId,
    commitSha: authorization.commitSha,
    artifactHash: authorization.artifactHash,
    authorizationHash: authorization.canonicalHash,
    authorizationNonce: authorization.nonce,
    capturedAt: now,
    expiresAt: authorization.expiresAt,
    active,
    restartable,
    runs: runs.value,
  };
  const census = Object.freeze({
    ...payload,
    fingerprint: sha256(canonicalJson(payload)),
  });
  return Object.freeze({ kind: "compiled", census });
};

export const toPromotionWorkflowCensus = (
  census: AuthorizedWorkflowCensus,
): PromotionWorkflowCensus =>
  Object.freeze({
    capturedAt: census.capturedAt,
    active: census.active,
    restartable: census.restartable,
    fingerprint: census.fingerprint,
  });

const parseAuthorization = (
  input: unknown,
): OperatorCensusAuthorization | undefined => {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "schemaVersion",
      "kind",
      "principalClass",
      "environment",
      "targetId",
      "commitSha",
      "artifactHash",
      "issuedAt",
      "expiresAt",
      "nonce",
      "canonicalHash",
    ]) ||
    input.schemaVersion !== 1 ||
    input.kind !== "operator-workflow-census-authorization" ||
    input.principalClass !== "operator" ||
    (input.environment !== "staging" && input.environment !== "production") ||
    !isBoundedId(input.targetId) ||
    !isCommit(input.commitSha) ||
    !isSha256(input.artifactHash) ||
    !isTime(input.issuedAt) ||
    !isTime(input.expiresAt) ||
    input.expiresAt <= input.issuedAt ||
    !isNonce(input.nonce) ||
    !isSha256(input.canonicalHash)
  ) {
    return undefined;
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: "operator-workflow-census-authorization",
    principalClass: "operator",
    environment: input.environment,
    targetId: input.targetId,
    commitSha: input.commitSha,
    artifactHash: input.artifactHash,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
    canonicalHash: input.canonicalHash,
  });
};

const parseRuns = (
  input: readonly WorkflowCensusRun[],
):
  | { readonly ok: true; readonly value: readonly WorkflowCensusRun[] }
  | { readonly ok: false; readonly finding: string } => {
  if (!Array.isArray(input)) {
    return { ok: false, finding: "Workflow census runs must be an array." };
  }
  const parsed: WorkflowCensusRun[] = [];
  for (const [index, run] of input.entries()) {
    if (
      !isRecord(run) ||
      !hasExactKeys(run, [
        "runFingerprint",
        "workflowId",
        "workflowVersion",
        "status",
        "runnerHash",
        "runtimeHash",
        "capabilityBindingsHash",
        "completionBindingHash",
      ]) ||
      !isSha256(run.runFingerprint) ||
      !isBoundedId(run.workflowId) ||
      !Number.isSafeInteger(run.workflowVersion) ||
      (run.workflowVersion as number) <= 0 ||
      (run.status !== "active" && run.status !== "restartable") ||
      !isSha256(run.runnerHash) ||
      !isSha256(run.runtimeHash) ||
      !isSha256(run.capabilityBindingsHash) ||
      !isSha256(run.completionBindingHash)
    ) {
      return {
        ok: false,
        finding: `Workflow census run ${index} is invalid or missing a versioned binding fingerprint.`,
      };
    }
    const payload: WorkflowCensusRunPayload = {
      workflowId: run.workflowId,
      workflowVersion: run.workflowVersion as number,
      status: run.status,
      runnerHash: run.runnerHash,
      runtimeHash: run.runtimeHash,
      capabilityBindingsHash: run.capabilityBindingsHash,
      completionBindingHash: run.completionBindingHash,
    };
    if (run.runFingerprint !== hashWorkflowCensusRun(payload)) {
      return {
        ok: false,
        finding: `Workflow census run ${index} fingerprint does not match its canonical versioned bindings.`,
      };
    }
    parsed.push(
      Object.freeze({
        runFingerprint: run.runFingerprint,
        ...payload,
      }),
    );
  }
  const identities = parsed.map(({ runFingerprint }) => runFingerprint);
  if (new Set(identities).size !== identities.length) {
    return { ok: false, finding: "Workflow census contains duplicate runs." };
  }
  if (
    identities.some(
      (identity, index) =>
        index > 0 && compareAscii(identities[index - 1] ?? "", identity) >= 0,
    )
  ) {
    return {
      ok: false,
      finding: "Workflow census runs must be in canonical fingerprint order.",
    };
  }
  return { ok: true, value: Object.freeze(parsed) };
};

const authorizationPayload = (
  authorization: OperatorCensusAuthorization,
): OperatorCensusAuthorizationPayload => ({
  schemaVersion: authorization.schemaVersion,
  kind: authorization.kind,
  principalClass: authorization.principalClass,
  environment: authorization.environment,
  targetId: authorization.targetId,
  commitSha: authorization.commitSha,
  artifactHash: authorization.artifactHash,
  issuedAt: authorization.issuedAt,
  expiresAt: authorization.expiresAt,
  nonce: authorization.nonce,
});

const validateBindings = (
  runs: readonly WorkflowCensusRun[],
  bindings: readonly WorkflowCensusBindingAuthority[],
): string | undefined => {
  const byIdentity = new Map<string, WorkflowCensusBindingAuthority>();
  for (const binding of bindings) {
    const key = `${binding.workflowId}@${binding.workflowVersion}`;
    if (byIdentity.has(key)) {
      return "Workflow census binding authority contains duplicates.";
    }
    byIdentity.set(key, binding);
  }
  if (byIdentity.size !== runs.length) {
    return "Workflow census binding authority must exactly cover the census runs.";
  }
  for (const run of runs) {
    const expected = byIdentity.get(`${run.workflowId}@${run.workflowVersion}`);
    if (expected === undefined) {
      return `Workflow census references unknown immutable binding ${run.workflowId}@${run.workflowVersion}.`;
    }
    for (const field of [
      "runnerHash",
      "runtimeHash",
      "capabilityBindingsHash",
      "completionBindingHash",
    ] as const) {
      if (run[field] !== expected[field]) {
        return `Workflow census ${field} does not match immutable binding ${run.workflowId}@${run.workflowVersion}.`;
      }
    }
  }
  return undefined;
};

const blocked = (
  code: Extract<WorkflowCensusResult, { kind: "blocked" }>["code"],
  finding: string,
): WorkflowCensusResult =>
  Object.freeze({
    kind: "blocked",
    code,
    findings: Object.freeze([finding]),
  });

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

const isNonce = (input: unknown): input is string =>
  typeof input === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(input);

const isTime = (input: unknown): input is number =>
  Number.isSafeInteger(input) && (input as number) >= 0;

const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

const canonicalJson = (value: CanonicalValue): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Readonly<Record<string, CanonicalValue>>;
  return `{${Object.keys(record)
    .sort(compareAscii)
    .map((key) => {
      const entry = record[key];
      if (entry === undefined)
        throw new Error("Census value contains undefined");
      return `${JSON.stringify(key)}:${canonicalJson(entry)}`;
    })
    .join(",")}}`;
};

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
