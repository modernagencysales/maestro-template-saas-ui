import type * as Schema from "effect/Schema";

export type PolicyScope = "system" | "workspace";
export type PolicyStatus = "draft" | "active" | "retired";
export type PolicyKind = "spend.limits" | "agent.config" | "prompt.override";

export type PolicyKindDefinition<
  TData extends Readonly<Record<string, unknown>>,
> = {
  readonly kind: PolicyKind;
  readonly schema: Schema.Codec<TData, unknown>;
  readonly evalRequired: boolean;
  readonly merge: (base: TData, override: Partial<TData>) => TData;
};

export type PolicyCandidate<TData extends Readonly<Record<string, unknown>>> = {
  readonly id: string;
  readonly kind: PolicyKind;
  readonly scope: PolicyScope;
  readonly workspaceId?: string;
  readonly version: number;
  readonly status: PolicyStatus;
  readonly data: TData;
  readonly createdAt: number;
  readonly activatedAt: number | null;
};
