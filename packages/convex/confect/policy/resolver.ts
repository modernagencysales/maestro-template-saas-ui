import * as Schema from "effect/Schema";

import type { PolicyCandidate, PolicyKind, PolicyScope } from "./kinds";

export class MissingPolicyError extends Schema.TaggedErrorClass<MissingPolicyError>()(
  "MissingPolicyError",
  {
    kind: Schema.Literals(["spend.limits", "agent.config", "prompt.override"]),
    workspaceId: Schema.String,
  },
) {}

export type PolicyPin = {
  readonly policyKey: string;
  readonly version: number;
};

export type PolicyResolverInput<
  TData extends Readonly<Record<string, unknown>>,
> = {
  readonly kind: PolicyKind;
  readonly workspaceId: string;
  readonly locale?: string;
  readonly pinned?: PolicyPin;
  readonly nowMs: number;
  readonly policies: readonly PolicyCandidate<TData>[];
};

export type PolicySnapshot<TData extends Readonly<Record<string, unknown>>> = {
  readonly kind: PolicyKind;
  readonly policyId: string;
  readonly policyKey: string;
  readonly version: number;
  readonly scope: PolicyScope;
  readonly workspaceId?: string;
  readonly workflowRunId: string;
  readonly resolvedAt: number;
  readonly data: TData;
};

const policyKeyFor = (
  policy: PolicyCandidate<Readonly<Record<string, unknown>>>,
): string =>
  policy.scope === "workspace" && policy.workspaceId
    ? `${policy.workspaceId}:${policy.kind}`
    : `system:${policy.kind}`;

const localeFor = (
  policy: PolicyCandidate<Readonly<Record<string, unknown>>>,
): string | undefined =>
  typeof policy.data.locale === "string" ? policy.data.locale : undefined;

const matchesLocale = (
  policy: PolicyCandidate<Readonly<Record<string, unknown>>>,
  locale: string | undefined,
): boolean => {
  const policyLocale = localeFor(policy);

  return locale
    ? policyLocale === locale
    : !policyLocale || policyLocale === "en-US";
};

const isActiveAt = (
  policy: PolicyCandidate<Readonly<Record<string, unknown>>>,
  nowMs: number,
): boolean =>
  policy.status === "active" &&
  policy.activatedAt !== null &&
  policy.activatedAt <= nowMs;

const isInScope = (
  policy: PolicyCandidate<Readonly<Record<string, unknown>>>,
  workspaceId: string,
): boolean =>
  policy.scope === "system" ||
  (policy.scope === "workspace" && policy.workspaceId === workspaceId);

const scopeRank = (
  policy: PolicyCandidate<Readonly<Record<string, unknown>>>,
): number => (policy.scope === "workspace" ? 2 : 1);

const sortNearest = <TData extends Readonly<Record<string, unknown>>>(
  left: PolicyCandidate<TData>,
  right: PolicyCandidate<TData>,
): number => {
  const scopeDiff = scopeRank(right) - scopeRank(left);

  return scopeDiff !== 0 ? scopeDiff : right.version - left.version;
};

export const resolvePolicy = <TData extends Readonly<Record<string, unknown>>>(
  input: PolicyResolverInput<TData>,
): PolicyCandidate<TData> | MissingPolicyError => {
  const pinned = input.pinned
    ? input.policies.find(
        (policy) =>
          policy.kind === input.kind &&
          policyKeyFor(policy) === input.pinned?.policyKey &&
          policy.version === input.pinned.version,
      )
    : undefined;

  if (pinned) {
    return pinned;
  }

  const candidates = input.policies
    .filter(
      (policy) =>
        policy.kind === input.kind &&
        isActiveAt(policy, input.nowMs) &&
        isInScope(policy, input.workspaceId),
    )
    .filter((policy) => matchesLocale(policy, input.locale))
    .sort(sortNearest);
  const selected = candidates[0];

  return (
    selected ??
    new MissingPolicyError({
      kind: input.kind,
      workspaceId: input.workspaceId,
    })
  );
};

export const resolvePolicySnapshot = <
  TData extends Readonly<Record<string, unknown>>,
>(
  input: PolicyResolverInput<TData> & {
    readonly workflowRunId: string;
  },
): PolicySnapshot<TData> | MissingPolicyError => {
  const policy = resolvePolicy(input);

  if (policy instanceof MissingPolicyError) {
    return policy;
  }

  const base = {
    kind: policy.kind,
    policyId: policy.id,
    policyKey: policyKeyFor(policy),
    version: policy.version,
    scope: policy.scope,
    workflowRunId: input.workflowRunId,
    resolvedAt: input.nowMs,
    data: policy.data,
  };

  return policy.workspaceId
    ? { ...base, workspaceId: policy.workspaceId }
    : base;
};
